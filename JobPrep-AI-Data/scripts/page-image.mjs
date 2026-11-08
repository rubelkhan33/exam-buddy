import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib");
const [file, pageNo, out] = process.argv.slice(2);
const doc = await PDFDocument.load(fs.readFileSync(file));
const page = doc.getPages()[Number(pageNo) - 1];
const xo = page.node.Resources().lookup(PDFName.of("XObject"));
for (const [k, ref] of xo.entries()) {
  const s = doc.context.lookup(ref);
  const d = s.dict;
  console.log(k.toString(), d.get(PDFName.of("Subtype"))?.toString(), d.get(PDFName.of("Filter"))?.toString(), d.get(PDFName.of("Width"))?.toString(), d.get(PDFName.of("Height"))?.toString());
  if (s instanceof PDFRawStream && String(d.get(PDFName.of("Filter"))).includes("DCT")) { fs.writeFileSync(out, s.contents); console.log("saved", out); }
}
