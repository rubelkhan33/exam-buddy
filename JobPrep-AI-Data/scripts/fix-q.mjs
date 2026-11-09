// Apply Claude's corrections to a Gemini chunk. Usage: node fix-q.mjs <chunk.json> '<json {"num":{field:value}}>'
// Keys may be "num" or "num@page" when a number repeats inside one chunk (two papers).
import fs from "node:fs";
import path from "node:path";
import { EXTRACTED } from "./lib.mjs";
const [file, patch] = process.argv.slice(2);
const f = path.join(EXTRACTED, "shikkhok_nibondhon_19_analysis", file);
const c = JSON.parse(fs.readFileSync(f, "utf8"));
for (const [key, fields] of Object.entries(JSON.parse(patch))) {
  const [n, p] = key.split("@").map(Number);
  const q = c.questions.find((x) => x.number === n && (!p || x.page === p));
  if (!q) { console.error("NOT FOUND", key); process.exitCode = 1; continue; }
  Object.assign(q, fields);
}
c.checkedBy = "claude (compared with page images)";
fs.writeFileSync(f, JSON.stringify(c, null, 1));
console.log(file, "patched", Object.keys(JSON.parse(patch)).length);
