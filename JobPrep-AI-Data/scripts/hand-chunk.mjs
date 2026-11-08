// Converts a compact hand-read chunk (02_extracted_text/_hand/c_chunk_*.json, read by Claude from the page images)
// into the pipeline's chunk JSON, so build-dataset.mjs and the daily Gemini run treat it as done.
// Input: { from, to, chapter, topic, headings?, items: [[num, page, sub, q, a, b, c, d, ans, expl, conf?, topic?]] }
// Usage: node hand-chunk.mjs ../02_extracted_text/_hand/c_chunk_0023_p111-115.json
import fs from "node:fs";
import path from "node:path";
import { EXTRACTED } from "./lib.mjs";
const [src] = process.argv.slice(2);
const c = JSON.parse(fs.readFileSync(src, "utf8"));
const name = path.basename(src).replace(/^c_/, "");
const out = path.join(EXTRACTED, "shikkhok_nibondhon_19_analysis", name);
const questions = c.items.map(([number, page, subtopic, question, a, b, cc, d, answer, explanation, confidence, topic]) => ({
  page, number, chapter: c.chapter, topic: topic ?? c.topic, subtopic, question, a, b, c: cc, d,
  answer: answer || null, explanation: explanation || null, sources: [], confidence: confidence ?? 0.9,
}));
const bad = questions.filter((q) => q.page < c.from || q.page > c.to || !["a", "b", "c", "d", null].includes(q.answer));
if (bad.length) { console.error("BAD", bad.map((q) => q.number)); process.exit(1); }
fs.writeFileSync(out, JSON.stringify({ book_id: "shikkhok_nibondhon_19_analysis", from: c.from, to: c.to, model: "claude-opus-5-5 (manual read)", finishReason: "STOP", headings: c.headings ?? [c.topic], questions }, null, 1));
console.log(name, questions.length, "questions, numbers", questions[0]?.number, "-", questions.at(-1)?.number);
