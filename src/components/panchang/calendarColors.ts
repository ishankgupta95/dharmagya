import { palette, semanticColors, type ColorPalette } from '@/config/theme';
import type { CalendarDay } from '@/services/astrology/calendarService';

// Auspicious-yoga banner accent. Mid-green chosen to clear ~4.5:1 on both
// parchment (#F4E9CE) and nightPlinthDeep (#1A1008) so the accent reads
// editorial-green in both themes without a per-theme swap.
export const AUSPICIOUS_GREEN = '#5DA85D';

/**
 * Per-cell event accent for both the compact and dense calendar grids.
 * Returns null when there's nothing meaningful to highlight (out-of-month or
 * `plain` category). Mirrors the priority used by `pickPrimaryEvent` in
 * calendarService so scanning down a month reads like Drik Panchang's
 * printed-almanac key:
 *   red       – eclipse
 *   sindoor   – major / user-deity festival (gold in dark mode for legibility)
 *   sindoor+  – sankranti
 *   green     – ekadashi
 *   gold      – purnima
 *   sindoor-  – amavasya
 *   gold      – pradosh
 *   muted     – any minor festival
 */
export function eventDotColor(
  day: CalendarDay | undefined,
  isDark: boolean,
  colors: ColorPalette,
): string | null {
  if (!day) return null;
  switch (day.eventCategory) {
    case 'eclipse':   return semanticColors.error;
    case 'festival':  return isDark ? palette.goldLeaf : palette.sindoor;
    case 'sankranti': return palette.sindoorWarm;
    case 'ekadashi':  return AUSPICIOUS_GREEN;
    case 'pournami':  return palette.goldLeaf;
    case 'amavasya':  return isDark ? palette.sindoorWarm : palette.sindoorDeep;
    case 'pradosh':   return palette.gold;
    case 'minor':     return colors.textTertiary;
    case 'plain':     return null;
  }
}
