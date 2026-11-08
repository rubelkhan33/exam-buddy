// Merges the per-chunk JSON into the final dataset, ranks every question and publishes it to the app.
// Usage: node build-dataset.mjs <book_id> --title "অগ্রদূত বাংলা (১০ম সংস্করণ)" --subject বাংলা [--demo]
import fs from "node:fs";
import path from "node:path";
import { APP_DATA, EXTRACTED, REVIEW, STRUCTURED, parseArgs, toLatinDigits } from "./lib.mjs";

const args = parseArgs();
const bookId = args._[0];
if (!bookId) {
  console.error('Usage: node build-dataset.mjs <book_id> --title "..." --subject বাংলা [--demo]');
  process.exit(1);
}
const subject = args.subject ?? "বাংলা";
const title = args.title ?? bookId;
const KEYS = { a: "ক", b: "খ", c: "গ", d: "ঘ" };

/** "৪৪তম বিসিএস" -> BCS, "সোনালী ব্যাংক" -> BANK, "পিএসসি"/"কর্ম কমিশন" -> PSC, else OTHER */
export function classify(tag) {
  const t = tag.toLowerCase();
  if (/বিসিএস|b\.?c\.?s/.test(t)) return "BCS";
  if (/ব্যাংক|bank/.test(t)) return "BANK";
  if (/পিএসসি|p\.?s\.?c|কর্ম\s*কমিশন|নন-?ক্যাডার/.test(t)) return "PSC";
  return "OTHER";
}

/** "…-২০১৯" -> 2019; "…: ২৪" (two-digit year after a colon) -> 2024 */
function yearOf(tag) {
  const t = toLatinDigits(tag);
  const full = t.match(/(19|20)\d{2}/);
  if (full) return Number(full[0]);
  const short = t.match(/[:：]\s*(\d{2})\s*$/);
  if (!short) return null;
  const yy = Number(short[1]);
  return yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy;
}

/** Collapses whitespace; used for every stored text field. */
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
/** "ইসমাইল হোসেন সিরাজী (১৮৮০-১৯৩১)" -> "ইসমাইল হোসেন সিরাজী", so the same topic groups together. */
const cleanTopic = (s) => norm(s).replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim();
/** "প্রথম ভাগ : বাংলা সাহিত্য" -> "বাংলা সাহিত্য" */
const cleanChapter = (s) => norm(s).replace(/^.*ভাগ\s*[:：]\s*/u, "").trim();
/** Option text without a stray answer marker such as "… উ. গ". */
const cleanOption = (s) => norm(s).replace(/\s*উ\s*[.:]\s*[কখগঘ]\s*$/u, "").trim();
/** Question text without a leading number such as "৫৫." or "12)". */
const cleanQuestion = (s) => norm(s).replace(/^[০-৯0-9]{1,3}\s*[.।)]\s*/u, "").trim();
/** Same exam written slightly differently ("২০ তম বিসিএস" / "২০তম বিসিএস") counts once. */
const sourceKey = (s) => toLatinDigits(s).replace(/[\s​-‍.,:;\-–]/gu, "").toLowerCase();
/** Splits tags the model joined ("A; B" or "A / B") and drops repeats. */
function uniqSources(list) {
  const seen = new Set();
  return list
    .flatMap((x) => String(x ?? "").split(/\s*[;；/]\s*/u))
    .map(norm)
    .filter((x) => x && !seen.has(sourceKey(x)) && seen.add(sourceKey(x)));
}
/** Duplicate-detection key: also ignores trailing punctuation. */
const keyOf = (s) => norm(s).replace(/[।?？.!]+$/u, "").trim();

const dir = path.join(EXTRACTED, bookId);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
if (!files.length) {
  console.error(`No extracted chunks in ${dir}. Run ocr-gemini.mjs first.`);
  process.exit(1);
}

/** Box titles and section names that are not real topics; such questions inherit the previous real topic. */
const NOT_A_TOPIC =
  /বিগত\s*পরীক্ষা|প্রশ্নসমূহ|অনুশীলনী|গুরুত্বপূর্ণ\s*প্রশ্ন|^অন্যান্য$|^বাংলা\s*(ব্যাকরণ|সাহিত্য|ভাষা)|^বিসিএস\s*প্রশ্ন|প্রিলিমিনারি|প্রশ্ন\s*সমাধান|সাজেশন|suggestion/iu;

/**
 * Book sections by PDF page, e.g. --sections "1:বাংলা সাহিত্য,321:বাংলা ব্যাকরণ,816:বিসিএস প্রিলিমিনারি প্রশ্ন".
 * Each question's chapter becomes the section its page falls in. In a section whose name contains
 * "বিসিএস", every question that names its exam (e.g. "৪০তম বিসিএস") gets that exam as its topic and source,
 * so a student can sit a whole past paper.
 */
// A name starting with "*" (or containing "বিসিএস") marks a section of solved past papers.
const SECTIONS = String(args.sections ?? "")
  .split(",")
  .map((s) => {
    const i = s.indexOf(":");
    return i < 0 ? [] : [s.slice(0, i), s.slice(i + 1)];
  })
  .filter(([p, name]) => p && name)
  .map(([p, name]) => {
    const paper = name.trim().startsWith("*") || name.includes("বিসিএস");
    return { from: Number(toLatinDigits(p)), name: norm(name.replace(/^\s*\*/, "")), paper };
  })
  .sort((a, b) => a.from - b.from);
const sectionInfo = (page) => SECTIONS.filter((s) => s.from <= page).pop() ?? null;
const sectionAt = (page) => sectionInfo(page)?.name ?? null;
const isPaperSection = (name) => !!SECTIONS.find((s) => s.name === name)?.paper;
const EXAM_NAME = /([০-৯0-9]+)\s*তম\s*বিসিএস(\s*\([^)]*\))?/u;
// Teacher registration (NTRCA) papers: "১৮তম কলেজ/সমপর্যায় নিবন্ধন প্রিলিমিনারি টেস্ট-২০২৪"
// "১৮তম কলেজ/সমপর্যায় …", "১৮তম শিক্ষক নিবন্ধন (কলেজ পর্যায়)-২০২৪", "১৮তম শিক্ষক নিবন্ধন"
const NTRCA_NAME = /([০-৯0-9]+)\s*(তম|ম|ষ্ঠ|র্থ|য়)\s*(?:(কলেজ|স্কুল\s*-?\s*২|স্কুল)|(?:শিক্ষক\s*)?নিবন্ধন)/u;
const LEVEL = /(কলেজ|স্কুল\s*-?\s*২|স্কুল)/u;
const YEAR = /((?:19|20|১৯|২০)[০-৯0-9]{2})/u;
/** Exam name from heading texts; `sectionName` supplies the level (কলেজ/স্কুল) when the heading omits it. */
const examNameIn = (sectionName, ...texts) => {
  for (const t of texts) {
    const s = norm(t);
    const m = s.match(EXAM_NAME);
    if (m) return `${m[1]}তম বিসিএস${m[2] ? " " + m[2].trim() : ""}`;
    const n = s.match(NTRCA_NAME);
    if (n) {
      const lv = (n[3] ?? s.match(LEVEL)?.[1] ?? String(sectionName ?? "").match(LEVEL)?.[1] ?? "").replace(/\s+/g, "");
      const level = lv.replace(/-?২$/, "-২");
      const y = s.match(YEAR);
      return `${n[1]}${n[2]} ${level ? level + " পর্যায়" : "নিবন্ধন"}${y ? ` (${y[1]})` : ""}`;
    }
    if (/বিশেষ/.test(s) && /নিবন্ধন/.test(s)) {
      const y = s.match(YEAR);
      return `বিশেষ নিবন্ধন পরীক্ষা${y ? ` (${y[1]})` : ""}`;
    }
  }
  return null;
};
const examName = (...texts) => examNameIn(null, ...texts);
/** An exam tag at the end of the question text, e.g. "… শব্দ? [পূবালী ব্যাংক: ১৯]" or "(… সুপারভাইজার: ১৯)". */
const TRAILING_TAG =
  /\s*[[(]([^[\]()]*(?:বিসিএস|ব্যাংক|পিএসসি|নিবন্ধন|পরিচালক|কর্মকর্তা|অফিসার|সহকারী|অডিটর|নিয়োগ|[:：]\s*[০-৯0-9]{2})[^[\]()]*)[\])]\s*$/u;

function splitTrailingTags(question) {
  let q = norm(question);
  const tags = [];
  for (let m = q.match(TRAILING_TAG); m; m = q.match(TRAILING_TAG)) {
    tags.unshift(...m[1].split(/\s*\/\s*/).map(norm).filter(Boolean));
    q = q.slice(0, m.index).trim();
  }
  return { question: q, tags };
}

/**
 * --chapters "কলেজ=*কলেজ পর্যায় — বিগত প্রশ্ন;ইংরেজি|English=ইংরেজি;বাংলা=বাংলা"
 * Maps the section title the model read (page header / chapter) to a fixed chapter name; first match wins,
 * "*" marks a past-paper chapter. Used instead of --sections when page numbers are unreliable.
 */
const CHAPTER_RULES = String(args.chapters ?? "")
  .split(";")
  .map((r) => r.split("="))
  .filter(([k, v]) => k && v)
  .map(([k, v]) => ({
    re: new RegExp(k.trim(), "iu"),
    name: norm(v.replace(/^\s*\*/, "")),
    paper: v.trim().startsWith("*"),
  }));
for (const r of CHAPTER_RULES) if (r.paper && !SECTIONS.some((s) => s.name === r.name)) SECTIONS.push({ from: Infinity, name: r.name, paper: true });
let lastRuleChapter = null;
const chapterByRule = (text) => {
  const hit = CHAPTER_RULES.find((r) => r.re.test(norm(text)));
  if (hit) lastRuleChapter = hit.name;
  return lastRuleChapter;
};

/**
 * --papers "কলেজ পর্যায় — বিগত প্রশ্ন=১৮তম কলেজ পর্যায় (২০২৪)|১৭তম কলেজ পর্যায় (২০২২)|…;স্কুল …=…"
 * The papers of each past-paper chapter in book order. A question number dropping back (e.g. 100 → 1)
 * starts the next paper; a printed paper heading at the start of a paper re-syncs the position.
 */
const PAPERS = new Map(
  String(args.papers ?? "")
    .split(";")
    .map((p) => p.split("="))
    .filter(([k, v]) => k && v)
    .map(([k, v]) => [norm(k), v.split("|").map(norm).filter(Boolean)]),
);
const paperState = new Map(); // chapter -> { idx, lastNum }
const baseName = (s) => s.split(" (")[0];
function paperFor(chapter, r0, labelled) {
  const list = PAPERS.get(chapter);
  if (!list) return null;
  const st = paperState.get(chapter) ?? { idx: 0, lastNum: null };
  const num = Number.isFinite(Number(r0.number)) && r0.number !== null ? Number(r0.number) : null;
  const labelIdx = labelled
    ? list.findIndex((n) => n === labelled || (baseName(n) === baseName(labelled) && !labelled.includes("(")))
    : -1;
  if (num !== null && st.lastNum !== null && num + 20 < st.lastNum) st.idx = Math.min(st.idx + 1, list.length - 1);
  // Trust a printed heading only where a paper starts (or when the book has no question numbers).
  if (labelIdx >= 0 && (num === null || num <= 3)) st.idx = labelIdx;
  if (num !== null) st.lastNum = num;
  paperState.set(chapter, st);
  return list[st.idx];
}

const merged = new Map();
const review = [];
let raw = 0;
let lastTopic = { chapter: null, topic: null };
for (const f of files) {
  const chunk = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const r0 of chunk.questions ?? []) {
    raw++;
    // Move exam tags out of the question text, and fix box-title topics.
    const split = splitTrailingTags(r0.question);
    const r = { ...r0, question: split.question, sources: [...(r0.sources ?? []), ...split.tags] };
    // The question's own page decides its section (falls back to the chunk start if the page looks wrong).
    const qPage = Number(r0.page) >= chunk.from && Number(r0.page) <= chunk.to ? Number(r0.page) : chunk.from;
    let section = CHAPTER_RULES.length
      ? chapterByRule(r0.chapter) ?? subject
      : SECTIONS.length
        ? sectionAt(qPage)
        : null;
    let topic = cleanTopic(r.topic);
    const paper = isPaperSection(section);
    let exam = paper ? examNameIn(section, r0.topic, r0.chapter) : null;
    if (paper && PAPERS.has(section)) exam = paperFor(section, r0, exam);
    if (paper && !exam && lastTopic.chapter === section && lastTopic.topic && (!topic || NOT_A_TOPIC.test(topic) || !section.includes("বিসিএস"))) {
      // Same past paper continuing on the next page without repeating its heading.
      exam = lastTopic.topic;
    }
    if (paper && !exam && section.includes("বিসিএস")) {
      // Past-paper pages without a readable exam name: file under the matching subject section instead.
      const subj = /সাহিত্য/.test(r0.chapter ?? "") ? SECTIONS.find((s) => /সাহিত্য/.test(s.name)) : null;
      section = subj?.name ?? SECTIONS.filter((s) => !s.paper).pop()?.name ?? section;
    }
    const chapter = section ?? cleanChapter(r.chapter);
    if (exam) {
      // Past-paper section: the exam is the topic, and it counts as a BCS source.
      topic = exam;
      if (!r.sources.some((s) => examName(s) === exam)) r.sources.push(exam);
      lastTopic = { chapter, topic };
    } else if (!topic || NOT_A_TOPIC.test(topic)) {
      // Pages run in order, so the previous real topic is the right one.
      topic = lastTopic.topic ?? "অন্যান্য";
    } else lastTopic = { chapter, topic };
    r.chapter = chapter;
    r.topic = topic;
    r.question = cleanQuestion(r.question);
    const options = { ক: cleanOption(r.a), খ: cleanOption(r.b), গ: cleanOption(r.c), ঘ: cleanOption(r.d) };
    const issue = !r.answer
      ? "answer missing"
      : Object.values(options).some((o) => !o)
        ? "option missing"
        : !norm(r.question)
          ? "question missing"
          : null;
    if (issue) {
      review.push({ ...r, chunk: f, issue });
      continue;
    }
    const baseKey = keyOf(r.question) + "|" + keyOf(options[KEYS[r.answer]]);
    if (exam) {
      // A past-paper question also printed in a topic chapter: credit that copy with this exam,
      // and keep this copy under the exam topic so the whole paper stays complete.
      const topicCopy = merged.get(baseKey);
      if (topicCopy) {
        topicCopy.sources = [...new Set([...topicCopy.sources, ...r.sources.map(norm)])].filter(Boolean);
        r.sources = [...new Set([...r.sources, ...topicCopy.sources])];
        r.explanation ||= topicCopy.explanation;
      }
    }
    const key = exam ? `${exam}|${baseKey}` : baseKey;
    const prev = merged.get(key);
    if (prev) {
      // Same question printed twice: keep one copy and merge its exam tags.
      prev.sources = [...new Set([...prev.sources, ...r.sources.map(norm)])].filter(Boolean);
      prev.explanation ||= r.explanation;
      continue;
    }
    merged.set(key, {
      page: r.page ?? null,
      chapter: r.chapter || subject,
      topic: r.topic,
      subtopic: norm(r.subtopic) || null,
      question: norm(r.question),
      options,
      answer: KEYS[r.answer],
      explanation: r.explanation ? String(r.explanation).trim() : null,
      sources: [...new Set(r.sources.map(norm).filter(Boolean))],
      confidence: r.confidence ?? null,
    });
  }
}

// Topic names misread by OCR ("চর্যাপद" vs "চর্যাপদ", "আলাউদ্দিন"/"আলাউদ্দীন"): fold a small topic
// into a bigger one of the same chapter whose name is almost identical.
{
  const editDistance = (a, b) => {
    const A = [...a], B = [...b];
    let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
    for (let i = 1; i <= A.length; i++) {
      const cur = [i];
      for (let j = 1; j <= B.length; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[B.length];
  };
  const all = [...merged.values()];
  const counts = new Map();
  for (const q of all) {
    const k = q.chapter + "|" + q.topic;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rename = new Map();
  for (const [k, c] of counts) {
    const [chapter, topic] = k.split("|");
    if (topic.includes("বিসিএস") || isPaperSection(chapter)) continue; // past papers are distinct on purpose
    let best = null;
    for (const [k2, c2] of counts) {
      const [ch2, t2] = k2.split("|");
      if (k2 === k || ch2 !== chapter || t2.includes("বিসিএস")) continue;
      if (c2 < c || (c2 === c && t2 > topic)) continue; // fold toward the bigger (or, on a tie, one fixed) name
      const d = editDistance(topic, t2);
      if (d <= Math.max(1, Math.floor(Math.min(topic.length, t2.length) / 6)) && (!best || c2 > best.c)) best = { t: t2, c: c2 };
    }
    if (best) rename.set(k, best.t);
  }
  for (const q of all) {
    const to = rename.get(q.chapter + "|" + q.topic);
    if (to) q.topic = to;
  }
  if (rename.size) console.log(`Merged ${rename.size} misspelled topic name(s) into their main topic.`);
}

let n = 0;
const questions = [...merged.values()].map((q) => {
  const sources = uniqSources(q.sources).map((s) => ({ exam_type: classify(s), exam_name: s, year: yearOf(s) }));
  const types = new Set(sources.map((s) => s.exam_type));
  const bcs_count = sources.filter((s) => s.exam_type === "BCS").length;
  const priority = bcs_count >= 2 ? 1 : bcs_count === 1 ? 2 : types.has("PSC") ? 3 : types.has("BANK") ? 4 : 5;
  const out = {
    id: `${bookId}-${String(++n).padStart(5, "0")}`,
    book_id: bookId,
    page: q.page,
    subject,
    chapter: q.chapter,
    topic: q.topic,
    subtopic: q.subtopic,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    sources,
    bcs_count,
    priority,
    // BCS and bank questions cost 0.50 per wrong answer, all others 0.25.
    negative_mark: types.has("BCS") || types.has("BANK") ? 0.5 : 0.25,
    ocr_confidence: q.confidence,
    review_status: q.confidence !== null && q.confidence < 0.7 ? "needs_review" : "auto",
  };
  if (out.review_status === "needs_review") review.push({ ...out, issue: "low confidence" });
  return out;
});

fs.mkdirSync(STRUCTURED, { recursive: true });
fs.mkdirSync(REVIEW, { recursive: true });
fs.mkdirSync(APP_DATA, { recursive: true });
fs.writeFileSync(path.join(STRUCTURED, `${bookId}.jsonl`), questions.map((q) => JSON.stringify(q)).join("\n") + "\n");
fs.writeFileSync(path.join(REVIEW, `${bookId}.review.jsonl`), review.map((q) => JSON.stringify(q)).join("\n") + (review.length ? "\n" : ""));

// Publish to the app: questions file + book index.
const appFile = `${bookId}.json`;
fs.writeFileSync(path.join(APP_DATA, appFile), JSON.stringify(questions));
const indexFile = path.join(APP_DATA, "books.json");
const books = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : [];
const entry = { id: bookId, title, subject, file: appFile, ...(args.demo ? { demo: true } : {}) };
const i = books.findIndex((b) => b.id === bookId);
if (i >= 0) books[i] = entry;
else books.push(entry);
// Real books first, demo data last.
books.sort((a, b) => Number(!!a.demo) - Number(!!b.demo));
fs.writeFileSync(indexFile, JSON.stringify(books, null, 2) + "\n");

const byP = [1, 2, 3, 4, 5].map((p) => questions.filter((q) => q.priority === p).length);
console.log(`${raw} raw -> ${questions.length} questions (${raw - questions.length - review.filter((r) => r.issue !== "low confidence").length} duplicates merged)`);
console.log(`Priority 1..5: ${byP.join(" / ")}`);
console.log(`Topics: ${new Set(questions.map((q) => q.topic)).size}`);
console.log(`Needs review: ${review.length} -> 04_review/${bookId}.review.jsonl`);
console.log(`Published -> jobprep-app/public/data/${appFile}`);
