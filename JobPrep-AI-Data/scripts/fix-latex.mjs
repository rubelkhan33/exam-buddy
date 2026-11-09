// Converts LaTeX left in Gemini chunks (\sqrt{..}, x^2, \frac{a}{b}) into plain Unicode math the app can show.
// Usage: node fix-latex.mjs <book_id> --only 10,11
import fs from "node:fs";
import path from "node:path";
import { EXTRACTED, parseArgs } from "./lib.mjs";

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "+": "⁺", n: "ⁿ", x: "ˣ", y: "ʸ", "(": "⁽", ")": "⁾" };
const sup = (s) => ([...s].every((ch) => SUP[ch]) ? [...s].map((ch) => SUP[ch]).join("") : `^(${s})`);
export function plainMath(t) {
  if (typeof t !== "string") return t;
  let s = t;
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\[3\]\{([^{}]*)\}/g, "∛($1)")
      .replace(/\\sqrt\[(\w+)\]\{([^{}]*)\}/g, "$1√($2)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(/\^\{([^{}]*)\}/g, (_, e) => sup(e))
      .replace(/_\{([^{}]*)\}/g, "$1");
  }
  return s
    .replace(/\^(-?\w)/g, (_, e) => sup(e))
    .replace(/√\((\w)\)/g, "√$1")
    .replace(/\\(times|cdot)/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pi/g, "π")
    .replace(/\\theta/g, "θ")
    .replace(/\\circ/g, "°")
    .replace(/\\(left|right)/g, "")
    .replace(/\$/g, "");
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const args = parseArgs();
  const dir = path.join(EXTRACTED, args._[0]);
  const only = args.only ? String(args.only).split(",").map(Number) : null;
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((f) => /^chunk_\d+.*\.json$/.test(f))) {
    if (only && !only.includes(Number(f.slice(6, 10)))) continue;
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const q of c.questions ?? [])
      for (const k of ["question", "a", "b", "c", "d", "explanation"]) {
        const v = plainMath(q[k]);
        if (v !== q[k]) { q[k] = v; n++; }
      }
    fs.writeFileSync(path.join(dir, f), JSON.stringify(c, null, 1));
  }
  console.log(`fixed ${n} fields`);
}
