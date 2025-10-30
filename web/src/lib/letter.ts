// web/src/lib/letter.ts
export function letterFromPct(pct: number): string {
  if (pct >= 97) return "A+";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}
