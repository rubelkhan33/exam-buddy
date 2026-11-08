const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** 64.5 -> "৬৪.৫" */
export function bn(value: number | string, fractionDigits?: number): string {
  const s =
    typeof value === "number" && fractionDigits !== undefined
      ? value.toFixed(fractionDigits)
      : String(value);
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Marks like 64.5, 64.25, 64 -> trims needless zeros */
export function bnMarks(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return bn(Number.isInteger(rounded) ? rounded : rounded.toString());
}

export function bnPercent(ratio: number): string {
  return bn(Math.round(ratio * 100)) + "%";
}

export function bnClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return bn(String(m).padStart(2, "0")) + ":" + bn(String(r).padStart(2, "0"));
}

export function bnDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return m > 0 ? `${bn(m)} মিনিট ${bn(s)} সেকেন্ড` : `${bn(s)} সেকেন্ড`;
}

export function bnDate(ts: number): string {
  return new Date(ts).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
}

export const PRIORITY_LABEL: Record<number, string> = {
  1: "বিসিএস — বারবার",
  2: "বিসিএস — একবার",
  3: "পিএসসি",
  4: "ব্যাংক",
  5: "অন্যান্য",
};
