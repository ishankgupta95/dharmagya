import festivalsData from '@/data/static/festivals.json';

type FestivalYear = { date: string; festivals: unknown[] }[];
const DATA = festivalsData as Record<string, FestivalYear>;

/**
 * Days (1-based) in the given (year, month) that have ≥1 festival.
 * Pure lookup against the pre-computed [festivals.json](../../data/static/festivals.json);
 * no panchang math, no `InteractionManager`, no blocking.
 */
export function getFestivalDaysInMonth(year: number, month: number): Set<number> {
  const entries = DATA[String(year)];
  if (!entries) return new Set();
  const days = new Set<number>();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (const e of entries) {
    if (e.festivals.length > 0 && e.date.startsWith(prefix)) {
      days.add(parseInt(e.date.slice(8, 10), 10));
    }
  }
  return days;
}
