// Merges the notes pass (ocr-gemini.mjs --mode notes) into one reading file per book for the app.
// Usage: node build-notes.mjs <book_id> --sections "<same as build-dataset>"
// Output: jobprep-app/public/data/<book_id>.notes.json  +  "notes" field in books.json
import fs from "node:fs";
import path from "node:path";
import { APP_DATA, EXTRACTED, STRUCTURED, parseArgs, toLatinDigits } from "./lib.mjs";

const args = parseArgs();
const bookId = args._[0];
if (!bookId) {
  console.error('Usage: node build-notes.mjs <book_id> --sections "1:বাংলা,453:ইংরেজি"');
  process.exit(1);
}
const dir = path.join(EXTRACTED, `${bookId}__notes`);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^chunk_.*\.json$/.test(f)).sort() : [];
if (!files.length) {
  console.error(`No notes in ${dir}. Run: node ocr-gemini.mjs ${bookId} --mode notes`);
  process.exit(1);
}

const norm = (s) => String(s ?? "").replace(/[ \t]+/g, " ").trim();
/** OCR sometimes drops in letters from unrelated scripts (Georgian, Devanagari, CJK…); the book never uses them. */
const STRAY_SCRIPTS = /[Ѐ-ӿ԰-֏֐-׿ऀ-ॿႠ-ჿ぀-ヿ一-鿿]/gu;
const clean = (s) => String(s ?? "").replace(STRAY_SCRIPTS, "");
const cleanTopic = (s) => norm(clean(s)).replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim();
const NOT_A_TOPIC = /সূচিপত্র|সাজেশন|প্রশ্ন\s*সমাধান|বিগত\s*পরীক্ষা|প্রশ্নসমূহ|^অন্যান্য$/iu;

// Same section syntax as build-dataset.mjs ("*" = past papers; notes there are kept under that section).
const SECTIONS = String(args.sections ?? "")
  .split(",")
  .map((s) => {
    const i = s.indexOf(":");
    return i < 0 ? null : { from: Number(toLatinDigits(s.slice(0, i))), name: norm(s.slice(i + 1).replace(/^\s*\*/, "")) };
  })
  .filter((s) => s && s.name)
  .sort((a, b) => a.from - b.from);
const sectionAt = (page) => SECTIONS.filter((s) => s.from <= page).pop()?.name ?? null;

const chapters = []; // [{ chapter, topics: [{ topic, blocks: [{ page, heading, md }] }] }]
let lastTopic = null;
let blocksIn = 0;
for (const f of files) {
  const chunk = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const b of chunk.notes ?? []) {
    const md = clean(b.markdown).trim();
    if (md.length < 15) continue; // stray captions
    blocksIn++;
    const page = Number(b.page) >= chunk.from && Number(b.page) <= chunk.to ? Number(b.page) : chunk.from;
    const chapter = (SECTIONS.length ? sectionAt(page) : null) ?? (norm(b.chapter) || "অন্যান্য");
    let topic = cleanTopic(b.topic);
    if (!topic || NOT_A_TOPIC.test(topic)) topic = lastTopic ?? norm(clean(b.heading)) ?? "অন্যান্য";
    lastTopic = topic;
    let ch = chapters.at(-1);
    if (!ch || ch.chapter !== chapter) chapters.push((ch = { chapter, topics: [] }));
    let tp = ch.topics.find((t) => t.topic === topic);
    if (!tp) ch.topics.push((tp = { topic, blocks: [] }));
    const heading = norm(clean(b.heading)) === topic ? "" : norm(clean(b.heading));
    const prev = tp.blocks.at(-1);
    // A block cut by the chunk boundary continues under the same heading: join it.
    if (prev && !heading && prev.page >= page - 1) prev.md += "\n\n" + md;
    else tp.blocks.push({ page, heading, md });
  }
}

const topicsCount = chapters.reduce((s, c) => s + c.topics.length, 0);
const chars = chapters.reduce((s, c) => s + c.topics.reduce((t, x) => t + x.blocks.reduce((u, b) => u + b.md.length, 0), 0), 0);

fs.mkdirSync(STRUCTURED, { recursive: true });
fs.mkdirSync(APP_DATA, { recursive: true });
const appFile = `${bookId}.notes.json`;
fs.writeFileSync(path.join(STRUCTURED, appFile), JSON.stringify(chapters, null, 1));
fs.writeFileSync(path.join(APP_DATA, appFile), JSON.stringify(chapters));

const indexFile = path.join(APP_DATA, "books.json");
const books = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : [];
const book = books.find((b) => b.id === bookId);
if (book) {
  book.notes = appFile;
  fs.writeFileSync(indexFile, JSON.stringify(books, null, 2) + "\n");
} else {
  console.warn(`Book ${bookId} is not in books.json yet; run build-dataset.mjs first, then this again.`);
}
console.log(`${blocksIn} note blocks -> ${chapters.length} chapters, ${topicsCount} topics, ~${Math.round(chars / 1000)}k characters`);
console.log(`Published -> jobprep-app/public/data/${appFile}`);
