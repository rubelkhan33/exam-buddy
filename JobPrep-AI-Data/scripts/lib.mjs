import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RAW = path.join(ROOT, "01_raw_pdfs");
export const EXTRACTED = path.join(ROOT, "02_extracted_text");
export const STRUCTURED = path.join(ROOT, "03_structured_json");
export const REVIEW = path.join(ROOT, "04_review");
export const APP_DATA = path.resolve(ROOT, "..", "jobprep-app", "public", "data");

/** Loads JobPrep-AI-Data/.env (GEMINI_API_KEY=...) if present. */
export function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

export function chunkDir(bookId) {
  return path.join(RAW, `${bookId}_chunks`);
}

export function listChunks(bookId) {
  const dir = chunkDir(bookId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".pdf"))
    .sort()
    .map((f) => {
      const m = f.match(/^chunk_(\d+)_p(\d+)-(\d+)\.pdf$/);
      return { file: path.join(dir, f), name: f.replace(/\.pdf$/, ""), from: Number(m[2]), to: Number(m[3]) };
    });
}

const BN = "০১২৩৪৫৬৭৮৯";
export const toLatinDigits = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
