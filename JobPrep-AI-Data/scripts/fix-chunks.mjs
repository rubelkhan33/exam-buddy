// Finds chunks that need another OCR pass and prepares them:
//  - pages photographed sideways (image wider than tall) are turned upright in the chunk PDF;
//  - chunks whose OCR came back with (almost) no questions are queued again.
// The old JSON of every queued chunk is moved to 02_extracted_text/<book>/_replaced/ so a re-run of
// ocr-gemini.mjs processes exactly these chunks.
// Usage: node fix-chunks.mjs <book_id> [--min 10] [--dry]
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFName, PDFRawStream, degrees } from "pdf-lib";
import { EXTRACTED, listChunks, parseArgs } from "./lib.mjs";

const args = parseArgs();
const bookId = args._[0];
if (!bookId) {
  console.error("Usage: node fix-chunks.mjs <book_id> [--min 10] [--dry]");
  process.exit(1);
}
const MIN = Number(args.min ?? 10);
const outDir = path.join(EXTRACTED, bookId);
const replaced = path.join(outDir, "_replaced");

const queue = [];
for (const chunk of listChunks(bookId)) {
  const doc = await PDFDocument.load(fs.readFileSync(chunk.file));
  let rotated = 0;
  for (const page of doc.getPages()) {
    const xo = page.node.Resources()?.lookup(PDFName.of("XObject"));
    if (!xo) continue;
    for (const [, ref] of xo.entries()) {
      const img = doc.context.lookup(ref);
      if (!(img instanceof PDFRawStream)) continue;
      const w = img.dict.get(PDFName.of("Width"))?.asNumber?.() ?? 0;
      const h = img.dict.get(PDFName.of("Height"))?.asNumber?.() ?? 0;
      if (w > h && page.getRotation().angle === 0) {
        // Photos in this book are turned clockwise; rotate the page back.
        page.setRotation(degrees(270));
        rotated++;
      }
    }
  }
  const json = path.join(outDir, `${chunk.name}.json`);
  const count = fs.existsSync(json) ? (JSON.parse(fs.readFileSync(json, "utf8")).questions ?? []).length : null;
  const reasons = [];
  if (rotated) reasons.push(`${rotated} sideways page(s)`);
  if (count !== null && count < MIN) reasons.push(`only ${count} questions`);
  if (!reasons.length) continue;
  queue.push(`${chunk.name}: ${reasons.join(", ")}`);
  if (args.dry) continue;
  if (rotated) fs.writeFileSync(chunk.file, await doc.save());
  if (count !== null) {
    fs.mkdirSync(replaced, { recursive: true });
    fs.renameSync(json, path.join(replaced, `${chunk.name}.json`));
  }
}
console.log(queue.join("\n"));
console.log(`${queue.length} chunk(s) ${args.dry ? "would be" : "are"} queued. Next: node ocr-gemini.mjs ${bookId}`);
