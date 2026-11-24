export interface AbcInput { key: string; label: string; revenue: number }
export interface AbcRow extends AbcInput { share: number; cumulative: number; cls: 'A' | 'B' | 'C' }
export type Movement = 'fast' | 'slow' | 'dead';

/** Revenue ke hisaab se: pehle 80% = A, agle 15% = B, baqi = C. */
export function abcAnalysis(rows: AbcInput[]): AbcRow[] {
  const sorted = [...rows].filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((a, r) => a + r.revenue, 0);
  let run = 0;
  return sorted.map((r) => {
    const before = total ? run / total : 0;
    run += r.revenue;
    const cls: 'A' | 'B' | 'C' = before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C';
    return { ...r, share: total ? Math.round((r.revenue / total) * 1000) / 10 : 0, cumulative: total ? Math.round((run / total) * 1000) / 10 : 0, cls };
  });
}

/** Dead = bika nahi aur 90+ din purana. Fast = bika hua qty stock ka 50% ya zyada. Baqi slow. */
export function classifyMovement(sold: number, units: number, oldestDays: number): Movement {
  if (sold <= 0) return oldestDays >= 90 ? 'dead' : 'slow';
  return units > 0 && sold / units >= 0.5 ? 'fast' : sold >= units ? 'fast' : 'slow';
}
