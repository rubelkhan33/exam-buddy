// Sends each PDF chunk to Gemini and saves the MCQs it reads as JSON.
// Usage: node ocr-gemini.mjs <book_id> [--mode notes] [--models a,b,c] [--limit 3] [--concurrency 2] [--only 4,5] [--redo]
// Needs GEMINI_API_KEY in the environment or in JobPrep-AI-Data/.env
import fs from "node:fs";
import path from "node:path";
import { EXTRACTED, listChunks, loadEnv, parseArgs } from "./lib.mjs";

loadEnv();
const args = parseArgs();
const bookId = args._[0];
// Several keys allowed: GEMINI_API_KEY, GEMINI_API_KEY_2 … _9. When one hits its daily quota, the next is used.
const KEYS = ["", ..."23456789"]
  .map((n) => process.env[`GEMINI_API_KEY${n ? "_" + n : ""}`]?.trim())
  .filter(Boolean);
let keyIdx = 0;
const KEY = KEYS[0];
// --models a,b,c: used in turn; when one model's daily quota is used up the next one takes over,
// and after the last model the next key starts again from the first model.
const MODELS = String(args.models ?? args.model ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
let modelIdx = 0;
const MODEL = MODELS[0];
// Only used for temporary overload (HTTP 503), and only when given explicitly.
const FALLBACK = args.fallback ?? process.env.GEMINI_FALLBACK_MODEL ?? null;
const CONCURRENCY =Number(args.concurrency ?? 2);
const LIMIT = args.limit ? Number(args.limit) : Infinity;

if (!bookId) {
  console.error("Usage: node ocr-gemini.mjs <book_id> [--limit N] [--concurrency 2] [--model name] [--redo]");
  process.exit(1);
}
if (!KEY) {
  console.error("GEMINI_API_KEY is missing. Put it in JobPrep-AI-Data/.env as GEMINI_API_KEY=your_key");
  process.exit(1);
}

const PROMPT = `You are reading scanned pages of a Bangla job-exam preparation book (BCS, PSC, bank and other recruitment MCQs).
The attached PDF has {COUNT} pages: photos of book pages, two columns each. They are PDF pages {FROM} to {TO}, in order.

Extract EVERY multiple-choice question on these pages (numbered ১., ২., … with options ⓚ/ক, ⓛ/খ, ⓜ/গ, ⓝ/ঘ). Read the left column top to bottom, then the right column. For each question return:
- page: the POSITION of the attached page it is on: first attached page = {FROM}, second = {FROM}+1, and so on. Ignore the page number printed on the paper.
- number: the question number printed before it (১., ২., … as an integer: "৭৭." → 77), or null.
- chapter: the big section in effect: prefer the running section title printed in the page header (e.g. "ইংরেজি", "গণিত", "ব্যাখ্যাসহ প্রশ্ন সমাধান : কলেজ পর্যায়"), else the chapter heading (e.g. "বাংলা সাহিত্য", "বাংলা ব্যাকরণ"), carried over from earlier pages if not repeated.
- topic: the subject heading the question is about, i.e. the author, period or grammar topic whose section it sits in (e.g. "ইসমাইল হোসেন সিরাজী", "মধ্যযুগ", "সন্ধি", "সমাস", "Voice Change", "শতকরা"). NEVER use a box title like "বিগত পরীক্ষায় আসা প্রশ্নসমূহ" or "অনুশীলনী" as the topic: use the author/topic heading those questions belong to.
  EXCEPTION, solved past papers: when the questions sit under a whole-exam heading (e.g. "১৮তম কলেজ/সমপর্যায় নিবন্ধন প্রিলিমিনারি টেস্ট-২০২৪", "৪০তম বিসিএস"), topic = that exam heading exactly as printed, carried over until the next exam heading.
- subtopic: a narrower heading if printed, else null. For solved past papers, put the question's subject here instead: "বাংলা", "ইংরেজি", "গণিত", "সাধারণ জ্ঞান" or "বিজ্ঞান".
- question: the question text exactly as printed, in Bangla Unicode, without its number.
- a, b, c, d: the four options exactly as printed (ক = a, খ = b, গ = c, ঘ = d), without the labels. Options are always names/values, never exam tags.
- answer: the correct option. It is usually printed at the end of each question as "উ. ক" / "উ. খ" / "উ. গ" / "উ. ঘ" or "উ: ক" (ক = "a", খ = "b", গ = "c", ঘ = "d"). It may also be a tick, bold option or answer key. If the answer is printed as "*" or "সঠিক উত্তর নেই", return null. null only if truly not shown.
- explanation: the explanation printed for that question (usually the paragraph starting "ব্যাখ্যা :" right below it), complete and exactly as printed, without the word "ব্যাখ্যা :". null if none.
- sources: the exam tags printed in square brackets after the question, e.g. "[১৩তম বিসিএস / ২৯তম বিসিএস]" → ["১৩তম বিসিএস", "২৯তম বিসিএস"]; split on "/". A tag can wrap onto the next line, join it. Copy digits exactly (৪৮ is not ৪৬). Empty array if none.
- confidence: 0 to 1, how sure you are that the text, options, answer and tags were read correctly.

Rules: copy text faithfully, never invent or "fix" questions, options, answers or sources. Use proper Bangla Unicode (no Bijoy/ANSI garbage).
Do not skip any numbered question; count them per box and make sure none is missing.
Skip anything that is not an MCQ (প্র./উ. written Q&A, ads, index pages). If a question continues onto the next attached page, join it.
Also return "headings": the chapter/topic headings you saw, in order, so the next pages can continue them.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    headings: { type: "ARRAY", items: { type: "STRING" } },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          page: { type: "INTEGER" },
          number: { type: "INTEGER", nullable: true },
          chapter: { type: "STRING" },
          topic: { type: "STRING" },
          subtopic: { type: "STRING", nullable: true },
          question: { type: "STRING" },
          a: { type: "STRING" },
          b: { type: "STRING" },
          c: { type: "STRING" },
          d: { type: "STRING" },
          answer: { type: "STRING", enum: ["a", "b", "c", "d"], nullable: true },
          explanation: { type: "STRING", nullable: true },
          sources: { type: "ARRAY", items: { type: "STRING" } },
          confidence: { type: "NUMBER" },
        },
        required: ["page", "chapter", "topic", "question", "a", "b", "c", "d", "answer", "sources", "confidence"],
      },
    },
  },
  required: ["headings", "questions"],
};

// --mode notes: a second pass that keeps everything EXCEPT the MCQs (study notes, tables, written Q&A).
const NOTES_PROMPT = `You are reading scanned pages of a Bangla job-exam preparation book.
The attached PDF has {COUNT} pages: photos of book pages, often two columns. They are PDF pages {FROM} to {TO}, in order.

Copy all STUDY CONTENT on these pages as faithful Markdown, so a student can read it in an app:
- descriptive text, rules, definitions, lists, "মনে রাখুন" boxes, tricks;
- tables (as Markdown tables, every row and column);
- written question-answers ("প্র." / "উ."), as "**প্র.** …" on one line and "**উ.** …" on the next;
- formulas (plain text, e.g. "a² + b² = (a + b)² − 2ab").

Do NOT include: multiple-choice questions (numbered questions with ক/খ/গ/ঘ options), their answers or their "ব্যাখ্যা" paragraphs (they are handled separately); the table of contents, ads, page headers/footers, page numbers.

Split the content into blocks, one per heading. For each block return:
- page: POSITION of the attached page where the block starts (first attached page = {FROM}). Ignore printed page numbers.
- chapter: the big section in effect (e.g. "বাংলা", "ইংরেজি", "গণিত", "সাধারণ জ্ঞান", "বাংলা সাহিত্য"), carried over from earlier pages.
- topic: the subject heading the block belongs to (e.g. "সমাস", "Voice Change", "শতকরা", "মুক্তিযুদ্ধ", "রবীন্দ্রনাথ ঠাকুর").
- heading: the block's own heading as printed (may equal topic), or "".
- markdown: the block content, copied exactly (Bangla Unicode, no Bijoy/ANSI garbage). Never summarise, never invent or "fix" facts.
Read the left column top to bottom, then the right column. If a block continues onto the next attached page, keep it in one block.
Return an empty "notes" array if the pages contain only MCQs. Also return "headings": the chapter/topic headings you saw, in order.`;

const NOTES_SCHEMA = {
  type: "OBJECT",
  properties: {
    headings: { type: "ARRAY", items: { type: "STRING" } },
    notes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          page: { type: "INTEGER" },
          chapter: { type: "STRING" },
          topic: { type: "STRING" },
          heading: { type: "STRING" },
          markdown: { type: "STRING" },
        },
        required: ["page", "chapter", "topic", "heading", "markdown"],
      },
    },
  },
  required: ["headings", "notes"],
};

const NOTES = args.mode === "notes";
const ACTIVE_PROMPT = NOTES ? NOTES_PROMPT : PROMPT;
const ACTIVE_SCHEMA = NOTES ? NOTES_SCHEMA : SCHEMA;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// When Gemini refuses to copy a page word for word (finishReason RECITATION), notes are asked for again as
// complete point-form study notes in the model's own wording, keeping every fact, name, number and table.
const NOTES_FACTS_HINT =
  "\n\nIMPORTANT: do not copy the text word for word. Rewrite each block as complete point-form study notes (Markdown bullet points and tables) in clear Bangla, keeping EVERY fact, name, date, number, rule and example from the page. Do not add anything that is not on the page.";

async function callGemini(chunk, prevHeadings, extraHint = "") {
  const text =
    ACTIVE_PROMPT.replaceAll("{FROM}", chunk.from).replaceAll("{TO}", chunk.to).replaceAll("{COUNT}", chunk.to - chunk.from + 1) +
    extraHint +
    (prevHeadings.length ? `\n\nHeadings in effect from the previous pages: ${prevHeadings.slice(-4).join(" > ")}` : "");
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: "application/pdf", data: fs.readFileSync(chunk.file).toString("base64") } },
          { text },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: ACTIVE_SCHEMA,
      maxOutputTokens: 60000,
    },
  };
  // When the main model stays overloaded, later attempts switch to the fallback model.
  for (let attempt = 1; ; attempt++) {
    const model = attempt > 4 && FALLBACK ? FALLBACK : MODELS[modelIdx];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let res, json;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEYS[keyIdx] },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000),
      });
      if (res.ok) json = await res.json();
    } catch (e) {
      // Dropped connection or timeout: wait and try again.
      if (attempt < 10) {
        const wait = Math.min(60000, 2000 * 2 ** attempt);
        console.warn(`  ${chunk.name}: ${e.cause?.code ?? e.name} (${model}), retrying in ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
    if (res.ok) {
      const cand = json.candidates?.[0];
      const out = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!out) throw new Error(`Empty response (finishReason=${cand?.finishReason ?? "?"})`);
      return { data: JSON.parse(out), usage: json.usageMetadata, finishReason: cand.finishReason, model };
    }
    const errText = await res.text();
    if (res.status === 429 && /per day|PerDay|free_tier_requests|exceeded your current quota/i.test(errText)) {
      // Daily quota used up: next model, then next key, or stop the whole run.
      if (model !== MODELS[modelIdx]) {
        attempt = 0; // it was the overload fallback that ran out; go back to the main model
        continue;
      }
      if (modelIdx < MODELS.length - 1) {
        modelIdx++;
        console.warn(`  Daily quota reached for ${model}. Switching to ${MODELS[modelIdx]}.`);
        attempt = 0;
        continue;
      }
      if (keyIdx < KEYS.length - 1) {
        keyIdx++;
        modelIdx = 0;
        console.warn(`  Daily quota reached on every model. Switching to key #${keyIdx + 1} (${MODELS[0]}).`);
        attempt = 0;
        continue;
      }
      quotaExhausted = true;
      throw new Error("DAILY_QUOTA: all keys have used today's free quota");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 10) {
      const wait = Math.min(60000, 2000 * 2 ** attempt);
      console.warn(`  ${chunk.name}: HTTP ${res.status} (${model}), retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }
}

// Notes go to their own folder so the MCQ build never sees them.
const outDir = path.join(EXTRACTED, NOTES ? `${bookId}__notes` : bookId);
fs.mkdirSync(outDir, { recursive: true });
const chunks = listChunks(bookId);
if (!chunks.length) {
  console.error(`No chunks found. Run first: node split-pdf.mjs ${bookId}`);
  process.exit(1);
}
// --only 40,41 runs just those chunk numbers (handy for spot checks)
const only = args.only ? String(args.only).split(",").map(Number) : null;
const todo = chunks
  .filter((c) => !only || only.includes(Number(c.name.slice(6, 10))))
  .filter((c) => args.redo || !fs.existsSync(path.join(outDir, `${c.name}.json`)))
  .slice(0, LIMIT);
console.log(`Models ${MODELS.join(" → ")}, ${KEYS.length} key(s). ${chunks.length} chunks, ${todo.length} to process.`);

// Headings carry across chunks, so use the last finished chunk before each one.
function headingsBefore(chunk) {
  const prev = chunks.filter((c) => c.to < chunk.from).reverse();
  for (const c of prev) {
    const f = path.join(outDir, `${c.name}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")).headings ?? [];
  }
  return [];
}

let done = 0,
  failed = 0,
  tokens = 0;
const queue = [...todo];
let quotaExhausted = false;
async function worker() {
  while (queue.length && !quotaExhausted) {
    const chunk = queue.shift();
    try {
      let result;
      try {
        result = await callGemini(chunk, headingsBefore(chunk));
      } catch (e) {
        if (!(NOTES && /RECITATION/.test(e.message))) throw e;
        console.warn(`  ${chunk.name}: refused to copy verbatim, asking for point-form notes instead`);
        result = await callGemini(chunk, headingsBefore(chunk), NOTES_FACTS_HINT);
      }
      const { data, usage, finishReason, model } = result;
      fs.writeFileSync(
        path.join(outDir, `${chunk.name}.json`),
        JSON.stringify({ book_id: bookId, from: chunk.from, to: chunk.to, model, finishReason, ...data }, null, 1),
      );
      tokens += usage?.totalTokenCount ?? 0;
      done++;
      console.log(`✓ ${chunk.name}: ${(NOTES ? data.notes : data.questions).length} ${NOTES ? "note blocks" : "questions"} (${finishReason})`);
    } catch (e) {
      failed++;
      fs.appendFileSync(path.join(outDir, "_errors.log"), `${new Date().toISOString()} ${chunk.name} ${e.message}\n`);
      console.error(`✗ ${chunk.name}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Finished: ${done} ok, ${failed} failed, ~${tokens.toLocaleString()} tokens used.`);
if (failed) console.log("Re-run the same command to retry the failed chunks.");
if (quotaExhausted) {
  console.log("STOPPED: today's quota is used up on every key. Add a new key (GEMINI_API_KEY_2=...) to .env, or run again tomorrow — finished chunks are kept.");
}
