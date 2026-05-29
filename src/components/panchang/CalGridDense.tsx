import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/common/AppText';
import { MONO_FONT, palette, type ColorPalette } from '@/config/theme';
import { localizePrimaryEvent } from '@/i18n/festivalNames';
import { localizeTithi } from '@/i18n/panchangNames';
import type { CalendarDay } from '@/services/astrology/calendarService';

import { eventDotColor } from './calendarColors';
import { MotionPressable } from '@/components/common/MotionPressable';

// Single-letter paksha tag rendered after the tithi name in each cell.
// English uses 'S'/'K'; Hindi uses 'शु'/'कृ' (Devanagari short forms of
// शुक्ल/कृष्ण). Keeping the abbreviation prevents the cell from wrapping.
function pakshaTag(paksha: 'shukla' | 'krishna', lang: string): string {
  if (lang === 'hi') return paksha === 'shukla' ? 'शु' : 'कृ';
  return paksha === 'shukla' ? 'S' : 'K';
}

const CELLS_PER_WEEK = 7;
const WEEKS_PER_MONTH = 6;

interface CalGridDenseProps {
  /** 42 cells (6 weeks × 7 weekdays), Sunday-leading row-major. Same shape as
   *  `getCalendarMonth().cells.map(c => c.date)`. */
  cells: (Date | null)[];
  cellLookup: Map<string, CalendarDay>;
  selectedDate: Date;
  today: Date;
  /** Visible Gregorian month index (0..11) — used to dim overflow days. */
  calMonthIdx: number;
  isDarkMode: boolean;
  colors: ColorPalette;
  /** 7 short weekday labels, Sunday-first. Same array as the compact header. */
  dayHeaders: string[];
  /** Active panchang language ('en' | 'hi') — drives tithi / paksha / event
   *  localisation. Cell content is stored canonical-English in `CalendarDay`;
   *  display strings get localised at render time. */
  panchangLang: string;
  /** Devanagari-or-Latin numeral formatter from `useLocaleFormatters`. */
  digits: (s: string) => string;
  onPickDay: (d: Date) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function ymdKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Transposed calendar — 7 weekday rows × 6 week columns. Each cell carries:
 *   ─ day number (large)
 *   ─ tithi + paksha letter (e.g. "Chaturthi K")
 *   ─ primary event name when present (festival / Ekadashi / Purnima / …)
 *
 * Sundays get the sindoor-red day number (Hindu calendar convention). Today
 * gets a thin accent ring; selected day gets a filled sindoor background.
 * Out-of-month cells are dimmed so the eye reads the visible month as a
 * coherent block. No daily-panchang fetch fires here — everything is read off
 * the existing `CalendarDay` snapshot already in `cellLookup`.
 */
export const CalGridDense = memo(function CalGridDense({
  cells,
  cellLookup,
  selectedDate,
  today,
  calMonthIdx,
  isDarkMode,
  colors,
  dayHeaders,
  panchangLang,
  digits,
  onPickDay,
}: CalGridDenseProps) {
  // Re-shape from row-major (week-rows) to column-major (weekday-rows).
  const rows = useMemo(() => {
    const out: (Date | null)[][] = [];
    for (let weekday = 0; weekday < CELLS_PER_WEEK; weekday++) {
      const row: (Date | null)[] = [];
      for (let week = 0; week < WEEKS_PER_MONTH; week++) {
        row.push(cells[week * CELLS_PER_WEEK + weekday] ?? null);
      }
      out.push(row);
    }
    return out;
  }, [cells]);

  return (
    <View style={[styles.grid, { borderColor: colors.border }]}>
      {rows.map((row, weekdayIdx) => {
        const isSunday = weekdayIdx === 0;
        const isLastRow = weekdayIdx === rows.length - 1;
        return (
          <View
            key={weekdayIdx}
            style={[
              styles.row,
              !isLastRow && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
            ]}>
            <View style={[styles.labelCell, { borderRightColor: colors.divider }]}>
              <Text
                variant="mono-caps"
                style={[styles.label, { color: isSunday ? palette.sindoor : colors.textMuted }]}>
                {dayHeaders[weekdayIdx]}
              </Text>
            </View>
            {row.map((cellDate, weekIdx) => {
              if (!cellDate) {
                return <View key={`${weekdayIdx}-${weekIdx}`} style={styles.cell} />;
              }
              const inMonth = cellDate.getMonth() === calMonthIdx;
              const isTodayCell = isSameDay(cellDate, today);
              const isSelected = isSameDay(cellDate, selectedDate);
              const day = cellLookup.get(ymdKey(cellDate));
              const eventColor = inMonth ? eventDotColor(day, isDarkMode, colors) : null;
              const hasNamedEvent = inMonth
                && day !== undefined
                && day.eventCategory !== 'plain'
                && day.primaryEventName.length > 0;

              const tithiLabel = day
                ? `${localizeTithi(day.tithiName, panchangLang)} ${pakshaTag(day.paksha, panchangLang)}`
                : '';
              const eventLabel = day && hasNamedEvent
                ? localizePrimaryEvent(day.primaryEventName, panchangLang)
                : '';

              const dayNumColor = isSelected
                ? palette.parchmentBright
                : !inMonth
                  ? colors.textDisabled
                  : isSunday
                    ? palette.sindoor
                    : eventColor ?? colors.textPrimary;

              const tithiColor = isSelected
                ? 'rgba(251,243,222,0.9)'
                : !inMonth
                  ? colors.textDisabled
                  : colors.textTertiary;

              const eventTextColor = isSelected
                ? palette.parchmentBright
                : eventColor ?? colors.textTertiary;

              return (
                <MotionPressable
                  key={`${weekdayIdx}-${weekIdx}`}
                  onPress={() => onPickDay(cellDate)}
                  style={[
                    styles.cell,
                    weekIdx > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.divider },
                    isSelected && { backgroundColor: palette.sindoor },
                    !isSelected && isTodayCell && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={cellDate.toDateString()}
                  accessibilityState={{ selected: isSelected }}>
                  <Text style={[styles.dayNum, { color: dayNumColor }]}>
                    {digits(String(cellDate.getDate()))}
                  </Text>
                  {inMonth && tithiLabel ? (
                    <Text
                      style={[styles.tithiText, { color: tithiColor }]}
                      numberOfLines={1}>
                      {tithiLabel}
                    </Text>
                  ) : null}
                  {eventLabel ? (
                    <Text
                      style={[styles.eventText, { color: eventTextColor }]}
                      numberOfLines={2}
                      ellipsizeMode="tail">
                      {eventLabel}
                    </Text>
                  ) : null}
                </MotionPressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    minHeight: 82,
  },
  labelCell: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  cell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
    borderColor: 'transparent',
    borderWidth: 1,
  },
  dayNum: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 14,
    lineHeight: 16,
  },
  tithiText: {
    fontFamily: MONO_FONT,
    fontSize: 7.5,
    letterSpacing: 0.2,
    marginTop: 1,
    textAlign: 'center',
  },
  eventText: {
    fontFamily: 'NotoSerifDevanagari_500Medium',
    fontSize: 8.5,
    lineHeight: 11,
    textAlign: 'center',
    marginTop: 1,
  },
});
