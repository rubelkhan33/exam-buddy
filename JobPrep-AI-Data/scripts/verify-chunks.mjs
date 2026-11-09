// Flags suspicious questions in Gemini chunks so Claude only has to check those against the page images.
// Usage: node verify-chunks.mjs <book_id> --only 29,30,31
// Checks: low confidence / "[অস্পষ্ট]", numbering gaps & duplicates per paper, missing options,
// duplicate options, missing answer, answer letter named in the explanation that disagrees, LaTeX left over.
import fs from "node:fs";
import path from "node:path";
import { EXTRACTED, parseArgs } from "./lib.mjs";

const args = parseArgs();
const bookId = args._[0];
const dir = path.join(EXTRACTED, bookId);
const only = args.only ? String(args.only).split(",").map(Number) : null;
const files = fs
  .readdirSync(dir)
  .filter((f) => /^chunk_\d+/.test(f) && f.endsWith(".json"))
  .filter((f) => !only || only.includes(Number(f.slice(6, 10))))
  .sort();

const LETTER = { ক: "a", খ: "b", গ: "c", ঘ: "d", a: "a", b: "b", c: "c", d: "d" };
const out = [];
let total = 0;
let prev = null; // { topic, number } carried across chunks
for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const q of c.questions ?? []) {
    total++;
    const why = [];
    const all = [q.question, q.a, q.b, q.c, q.d, q.explanation].join(" ");
    if ((q.confidence ?? 1) < 0.8) why.push(`confidence ${q.confidence}`);
    if (all.includes("অস্পষ্ট")) why.push("অস্পষ্ট");
    if (/\\(sqrt|frac)|\^\{|_\{/.test(all)) why.push("LaTeX");
    const opts = [q.a, q.b, q.c, q.d].map((o) => String(o ?? "").trim());
    if (opts.some((o) => !o)) why.push("empty option");
    if (new Set(opts).size < 4) why.push("duplicate options");
    if (!q.answer) why.push("no answer");
    const m = String(q.explanation ?? "").match(/সঠিক উত্তর\s*(?:হবে)?\s*(?:অপশন)?\s*\(?\s*([কখগঘ])\s*\)/);
    if (m && q.answer && LETTER[m[1]] !== q.answer) why.push(`explanation says (${m[1]}) but answer=${q.answer}`);
    if (prev && q.topic === prev.topic && q.number != null && prev.number != null && q.number !== prev.number + 1)
      why.push(`numbering jump ${prev.number}→${q.number}`);
    if (prev && q.topic !== prev.topic && q.number != null && q.number !== 1) why.push(`new paper starts at ${q.number}`);
    prev = { topic: q.topic, number: q.number };
    if (why.length) out.push({ file: f, page: q.page, number: q.number, topic: q.topic, why: why.join("; "), q: String(q.question).slice(0, 60) });
  }
}
const report = path.join(dir, "_doubts.json");
fs.writeFileSync(report, JSON.stringify(out, null, 1));
console.log(`${files.length} chunks, ${total} questions, ${out.length} flagged → ${report}`);
for (const d of out) console.log(`p${d.page} #${d.number} [${d.why}] ${d.q}`);
