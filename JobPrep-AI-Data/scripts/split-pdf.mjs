// Splits a large scanned PDF into small page chunks that can be sent to Gemini.
// Usage: node split-pdf.mjs <book_id> [--pages 5] [--from 1] [--to 854]
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { RAW, chunkDir, parseArgs } from "./lib.mjs";

const args = parseArgs();
const bookId = args._[0];
if (!bookId) {
  console.error("Usage: node split-pdf.mjs <book_id> [--pages 5] [--from 1] [--to N]");
  process.exit(1);
}
const src = path.join(RAW, `${bookId}.pdf`);
if (!fs.existsSync(src)) {
  console.error(`Not found: ${src}`);
  process.exit(1);
}

const per = Number(args.pages ?? 5);
console.log(`Loading ${src} (this can take a minute for large files)…`);
const doc = await PDFDocument.load(fs.readFileSync(src), { ignoreEncryption: true, updateMetadata: false });
const total = doc.getPageCount();
const from = Math.max(1, Number(args.from ?? 1));
const to = Math.min(total, Number(args.to ?? total));
const out = chunkDir(bookId);
fs.mkdirSync(out, { recursive: true });
console.log(`${total} pages. Writing pages ${from}-${to} in chunks of ${per} to ${out}`);

let n = 0;
for (let start = from; start <= to; start += per) {
  const end = Math.min(to, start + per - 1);
  const idx = Math.floor((start - 1) / per) + 1;
  const name = `chunk_${String(idx).padStart(4, "0")}_p${start}-${end}.pdf`;
  const file = path.join(out, name);
  if (fs.existsSync(file)) continue;
  const part = await PDFDocument.create();
  const pages = await part.copyPages(
    doc,
    Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i),
  );
  pages.forEach((p) => part.addPage(p));
  fs.writeFileSync(file, await part.save());
  n++;
  if (n % 20 === 0) console.log(`  …${name}`);
}
console.log(`Done. ${n} new chunk(s) written.`);
