import { palette, type ColorPalette } from '@/config/theme';
import type { CalendarDay } from '@/services/astrology/calendarService';

/**
 * Per-cell event accent for both the compact and dense calendar grids.
 * Returns null when there's nothing meaningful to highlight (out-of-month or
 * `plain` category).
 *
 * This value is read as TEXT, not just as a dot: CalGridDense paints the 14px
 * day number and the 8.5px event name with it, and the Panchang glance line
 * renders it at 22px. So every branch has to clear 4.5:1 against BOTH grounds
 * (#171220 night, #F8F4F2 rice) — which is why every branch is per-theme,
 * either via a semantic token or an explicit `isDark` step. The one deliberate
 * exception is `minor` (3.93:1 dark / 3.19:1 light): minor-festival days are
 * meant to recede, and lifting them to `textSecondary` would make them read
 * as loud as an ordinary day.
 *
 * Diya has one accent, so colour now separates four families rather than the
 * seven distinct tones the old parchment key implied; the event NAME printed
 * beside the number carries the finer distinction. Family order mirrors
 * `pickPrimaryEvent` in calendarService:
 *   accent      – major / user-deity festival
 *   danger      – eclipse
 *   accent      – sankranti
 *   affirmative – ekadashi
 *   accent      – purnima
 *   accent-deep – amavasya (the one branch that still earns a second step)
 *   accent      – pradosh
 *   muted       – any minor festival
 */
export function eventDotColor(
  day: CalendarDay | undefined,
  isDark: boolean,
  colors: ColorPalette,
): string | null {
  if (!day) return null;
  switch (day.eventCategory) {
    case 'eclipse':   return colors.dangerText;
    case 'festival':  return colors.accentText;
    case 'sankranti': return colors.accentText;
    case 'ekadashi':  return colors.successText;
    case 'pournami':  return colors.accentText;
    // The only branch that keeps a hand-picked step: on the light ground a
    // deeper turmeric separates the new moon from the full moon, which would
    // otherwise be the same accent. No non-deprecated token sits below
    // `turmericInk`, so the legacy alias stays until one exists. Dark has the
    // headroom for the ordinary accent.
    case 'amavasya':  return isDark ? colors.accentText : palette.sindoorDeep;
    case 'pradosh':   return colors.accentText;
    case 'minor':     return colors.textTertiary;
    case 'plain':     return null;
  }
}
