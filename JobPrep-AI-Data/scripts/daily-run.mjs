// Runs every day (Windows Task Scheduler) until every book in books.config.json is fully processed:
//   1. MCQ OCR for unfinished chunks (stops by itself when the day's free quota is used up)
//   2. once the MCQs are complete: re-check empty/sideways chunks, then the notes pass
//   3. rebuild the app data, then commit and push it so Vercel redeploys
// Usage: node daily-run.mjs [--no-push]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXTRACTED, ROOT, listChunks, parseArgs } from "./lib.mjs";

const args = parseArgs();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "..");
const LOG = path.join(ROOT, "daily-run.log");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "books.config.json"), "utf8"));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
}

function run(cmd, argv, cwd = HERE) {
  log(`$ ${cmd} ${argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  const r = spawnSync(cmd, argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const tail = out.trim().split("\n").filter((l) => /^(✓|✗)/.test(l) === false).slice(-6).join("\n");
  if (tail) log(tail);
  return { code: r.status, out };
}

const done = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^chunk_.*\.json$/.test(f)).length : 0;

for (const book of config.books) {
  const total = listChunks(book.id).length;
  if (!total) {
    log(`${book.id}: no chunks (run split-pdf.mjs first) — skipped`);
    continue;
  }
  const mcqDir = path.join(EXTRACTED, book.id);
  const notesDir = path.join(EXTRACTED, `${book.id}__notes`);

  if (done(mcqDir) < total) {
    run("node", ["ocr-gemini.mjs", book.id, "--models", book.models.join(","), "--concurrency", "2"]);
    if (done(mcqDir) >= total) run("node", ["fix-chunks.mjs", book.id]);
    if (done(mcqDir) < total) run("node", ["ocr-gemini.mjs", book.id, "--models", book.models.join(","), "--concurrency", "2"]);
  }
  const mcqComplete = done(mcqDir) >= total;
  log(`${book.id}: MCQ chunks ${done(mcqDir)}/${total}`);

  if (book.notes && mcqComplete && done(notesDir) < total) {
    run("node", ["ocr-gemini.mjs", book.id, "--mode", "notes", "--models", (book.notesModels ?? book.models).join(","), "--concurrency", "2"]);
  }
  if (book.notes) log(`${book.id}: notes chunks ${done(notesDir)}/${total}`);

  const buildArgs = ["build-dataset.mjs", book.id, "--title", book.title, "--subject", book.subject];
  if (book.sections) buildArgs.push("--sections", book.sections);
  if (book.chapters) buildArgs.push("--chapters", book.chapters);
  if (book.papers) buildArgs.push("--papers", book.papers);
  if (done(mcqDir)) run("node", buildArgs);
  if (done(notesDir)) {
    const notesArgs = ["build-notes.mjs", book.id];
    if (book.sections) notesArgs.push("--sections", book.sections);
    run("node", notesArgs);
  }
}

if (!args["no-push"]) {
  const paths = [
    "jobprep-app/public/data",
    "JobPrep-AI-Data/02_extracted_text",
    "JobPrep-AI-Data/03_structured_json",
    "JobPrep-AI-Data/04_review",
  ];
  run("git", ["add", "--", ...paths], REPO);
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: REPO }).status !== 0;
  if (staged) {
    run("git", ["commit", "-m", `Daily data update ${new Date().toISOString().slice(0, 10)}`], REPO);
    const push = run("git", ["push"], REPO);
    log(push.code === 0 ? "Pushed to GitHub (Vercel will redeploy)." : "Push failed — will retry tomorrow.");
  } else log("No data changes to publish.");
}
log("Daily run finished.");
