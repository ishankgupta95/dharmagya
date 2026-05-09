import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Ornament } from './Ornament';
import { useStore } from '@/store/useStore';
import { buildCalendarCells, isSameDay } from '@/utils/calendar';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
import { borderRadius, MONO_FONT, type ColorPalette } from '@/config/theme';

/**
 * Sole date-picker primitive for the app. Month grid + month/year jumper —
 * the right affordance for both DOB scrubbing (decades back) and day-to-day
 * navigation (Panchang). Wraps everything in the Sacred Editorial sheet
 * chrome (display-italic title, lotus rule, paper-edge border, mono-caps CTA).
 *
 * For time-of-day selection, see [TimePickerModal](./TimePickerModal.tsx).
 */
export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Currently-selected date (or today if null). */
  value: Date | null;
  /** Called when the user confirms a date. */
  onPick: (date: Date) => void;
  /** Optional "Clear" button handler — hidden if undefined. */
  onClear?: () => void;
  /** Lower bound for year selection (inclusive). Defaults to 1900. */
  minYear?: number;
  /** Upper bound for year selection (inclusive). Defaults to current year. */
  maxYear?: number;
  /**
   * Lower-bound date (inclusive). Cells before this date are disabled.
   * Use when picking forward-only dates (e.g. event scheduling).
   */
  minDate?: Date;
  /**
   * Upper-bound date (inclusive). Cells after this date are disabled.
   * Use e.g. `new Date()` for a DOB picker so the user can't pick a future
   * birthday. If omitted, only the year range enforces bounds.
   */
  maxDate?: Date;
  colors: ColorPalette;
  /** Header title to display. */
  title?: string;
  /**
   * `'day'` (default) — full picker. Opens on the day grid; user commits by
   * tapping a day. Use when this modal is the only place dates can be picked.
   *
   * `'month'` — month-jumper. Opens directly on the year page; tapping a year
   * advances to the month page; tapping a month commits with the day-of-month
   * preserved from `value` (clamped to the month length) and closes. Use when
   * the parent screen already has its own day grid (e.g. Panchang) so the
   * modal only needs to pick a year + month to navigate to.
   */
  mode?: 'day' | 'month';
}

export function DatePickerModal({
  visible,
  onClose,
  value,
  onPick,
  onClear,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  minDate,
  maxDate,
  colors,
  title,
  mode = 'day',
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const initial = value ?? new Date();
  const [calMonth, setCalMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  // Three pages: 'day' (calendar grid), 'year' (year picker), 'month' (month
  // picker for jumperYear). In mode='day' the picker opens on 'day' and the
  // header tap walks day → year → month → day. In mode='month' it opens on
  // 'year' and tapping a month commits + closes (no day step at all).
  const [page, setPage] = useState<'day' | 'year' | 'month'>(
    mode === 'month' ? 'year' : 'day'
  );
  const [jumperYear, setJumperYear] = useState(calMonth.getFullYear());

  // Re-sync internal state whenever the modal becomes visible, so reopening
  // after a saved DOB lands on the saved month instead of today's month.
  // Also resets to the entry page for the configured mode.
  useEffect(() => {
    if (!visible) return;
    const base = value ?? new Date();
    setCalMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setJumperYear(base.getFullYear());
    setPage(mode === 'month' ? 'year' : 'day');
  }, [visible, value, mode]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const effectiveMinYear = minDate ? Math.max(minYear, minDate.getFullYear()) : minYear;
  const effectiveMaxYear = maxDate ? Math.min(maxYear, maxDate.getFullYear()) : maxYear;

  const years = useMemo(() => {
    const count = effectiveMaxYear - effectiveMinYear + 1;
    return Array.from({ length: count }, (_, i) => effectiveMaxYear - i);
  }, [effectiveMinYear, effectiveMaxYear]);

  function prevMonth() {
    const next = new Date(year, month - 1, 1);
    if (next.getFullYear() < effectiveMinYear) return;
    if (minDate && endOfMonth(next) < minDate) return;
    setCalMonth(next);
  }

  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    if (next.getFullYear() > effectiveMaxYear) return;
    if (maxDate && next > startOfMonth(maxDate)) return;
    setCalMonth(next);
  }

  function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  function isMonthDisabled(y: number, m: number) {
    if (maxDate && new Date(y, m, 1) > startOfMonth(maxDate)) return true;
    if (minDate && new Date(y, m + 1, 0) < startOfDay(minDate)) return true;
    return false;
  }

  function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function openYearPage() {
    setJumperYear(year);
    setPage('year');
  }

  function pickYear(y: number) {
    setJumperYear(y);
    setPage('month');
  }

  function pickMonth(m: number) {
    if (mode === 'month') {
      // No day step in month mode — commit immediately, preserving the
      // day-of-month from `value` (clamped to the selected month's length so
      // e.g. Jan 31 → Feb doesn't overflow).
      const day = value?.getDate() ?? 1;
      const lastDay = new Date(jumperYear, m + 1, 0).getDate();
      handlePick(new Date(jumperYear, m, Math.min(day, lastDay)));
      return;
    }
    setCalMonth(new Date(jumperYear, m, 1));
    setPage('day');
  }

  function goBack() {
    if (page === 'month') setPage('year');
    else if (page === 'year') {
      // In month mode the year page is the entry point — back closes the
      // modal entirely. In day mode it returns to the day grid.
      if (mode === 'month') onClose();
      else setPage('day');
    }
  }

  function handlePick(date: Date) {
    onPick(date);
    onClose();
  }

  // Pad the years to a multiple of 4 so the trailing row is always full —
  // otherwise the lone last chip (e.g. 1900 by itself) stretches with flex:1
  // and fills the whole row. Negative sentinels render as invisible spacers.
  const paddedYears = useMemo(() => {
    const remainder = years.length % 4;
    if (remainder === 0) return years;
    return [...years, ...Array.from({ length: 4 - remainder }, (_, i) => -1 - i)];
  }, [years]);

  const yearRows = useMemo(() => chunk(paddedYears, 4), [paddedYears]);

  // Row index that, when set as FlatList's initialScrollIndex, lands the
  // selected year roughly in the centre of the visible window. With 4 visible
  // rows we anchor the row 2 above target as the top — target then sits at
  // visual row 2 (3rd from top), close to centre.
  const yearInitialRowIndex = useMemo(() => {
    const idx = years.indexOf(jumperYear);
    if (idx < 0) return 0;
    const targetRow = Math.floor(idx / 4);
    return Math.max(0, targetRow - Math.floor(YEAR_GRID_VISIBLE_ROWS / 2));
  }, [years, jumperYear]);

  const canPrev =
    (year > effectiveMinYear || month > 0) && !isMonthDisabled(year, month - 1);
  const canNext =
    (year < effectiveMaxYear || month < 11) && !isMonthDisabled(year, month + 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>

          <Text
            variant="display-italic"
            style={[styles.title, { color: colors.textPrimary }]}>
            {title ?? t('common.pickDate')}
          </Text>
          <Ornament variant="lotus" tone={isDark ? 'dark' : 'light'} style={styles.rule} />

          {/* ─── Page: DAY (calendar) ───────────────────────────────────── */}
          {page === 'day' && (
            <>
              {/* Month nav — left/right chevrons step ±1 month; the centre
                  label is tappable and opens the year picker (year → month →
                  back to day grid). */}
              <View style={styles.monthRow}>
                <TouchableOpacity
                  onPress={prevMonth}
                  hitSlop={12}
                  disabled={!canPrev}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.previousMonth')}
                  accessibilityState={{ disabled: !canPrev }}>
                  <Icon name="chevron-left" size={20} color={canPrev ? colors.textSecondary : colors.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openYearPage}
                  hitSlop={6}
                  activeOpacity={0.7}
                  style={[
                    styles.monthLabelRow,
                    { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.openDatePicker')}>
                  <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                    {(t('panchang.monthNames', { returnObjects: true }) as string[])[month]} {year}
                  </Text>
                  <View style={[styles.monthLabelDivider, { backgroundColor: colors.border }]} />
                  <Icon name="caret-down" size={11} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={nextMonth}
                  hitSlop={12}
                  disabled={!canNext}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.nextMonth')}
                  accessibilityState={{ disabled: !canNext }}>
                  <Icon name="chevron-right" size={20} color={canNext ? colors.textSecondary : colors.textDisabled} />
                </TouchableOpacity>
              </View>

              {/* Day headers */}
              <View style={styles.calRow}>
                {(t('panchang.dayHeaders', { returnObjects: true }) as string[]).map((d, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.dayHeader,
                      { color: (i === 0 || i === 6) ? colors.textDisabled : colors.textMuted },
                    ]}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar cells — rendered as rows of 7 with flex:1 cells so
                  iOS percentage rounding can't push the 7th cell to a new row. */}
              <View style={styles.calGrid}>
                {chunk(cells, 7).map((row, ri) => (
                  <View key={ri} style={styles.calRowGrid}>
                    {row.map((cell, ci) => {
                      const idx = ri * 7 + ci;
                      if (cell === null) {
                        return <View key={`blank-${idx}`} style={styles.cell} />;
                      }
                      const cellDate = new Date(year, month, cell);
                      const isSelected = value ? isSameDay(cellDate, value) : false;
                      const isWeekend = ci === 0 || ci === 6;
                      const isFuture = !!maxDate && cellDate > maxDate;
                      const isPast = !!minDate && cellDate < startOfDay(minDate);
                      const isOutOfRange = isFuture || isPast;
                      const textColor = isSelected
                        ? colors.base
                        : isOutOfRange ? colors.textDisabled
                        : isWeekend ? colors.textDisabled : colors.textSecondary;
                      return (
                        <TouchableOpacity
                          key={cell}
                          style={styles.cell}
                          disabled={isOutOfRange}
                          onPress={() => handlePick(cellDate)}
                          accessibilityRole="button"
                          accessibilityLabel={cellDate.toDateString()}
                          accessibilityState={{ selected: isSelected, disabled: isOutOfRange }}>
                          <View style={[
                            styles.cellInner,
                            isSelected && { backgroundColor: colors.accent },
                            isOutOfRange && { opacity: 0.35 },
                          ]}>
                            <Text style={[styles.dayNum, { color: textColor }]}>{cell}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {row.length < 7 && Array.from({ length: 7 - row.length }, (_, i) => (
                      <View key={`pad-${ri}-${i}`} style={styles.cell} />
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.bottomRow}>
                {onClear && (
                  <TouchableOpacity
                    onPress={() => { onClear(); onClose(); }}
                    style={[styles.bottomBtn, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.clear', { defaultValue: 'Clear' })}>
                    <Text variant="mono-caps" style={[styles.bottomBtnText, { color: colors.textSecondary }]}>
                      {t('common.clear', { defaultValue: 'Clear' })}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.bottomBtn, styles.bottomBtnPrimary, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.done')}>
                  <Text variant="mono-caps" style={[styles.bottomBtnText, { color: colors.base }]}>
                    {t('common.done')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ─── Page: YEAR ─────────────────────────────────────────────── */}
          {page === 'year' && (
            <>
              <View style={styles.pageHeader}>
                <TouchableOpacity
                  onPress={goBack}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}>
                  <Icon name="chevron-left" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text variant="mono-caps" style={[styles.pageHeaderLabel, { color: colors.textMuted }]}>
                  {t('common.year', { defaultValue: 'Year' })}
                </Text>
                <View style={styles.pageHeaderSpacer} />
              </View>

              {/* Year grid uses FlatList where each item is a pre-built row of
                  4 chips (numColumns is intentionally 1) — this avoids the
                  numColumns + initialScrollIndex bug we hit on Android, and
                  virtualization keeps render fast on low-end devices. */}
              <FlatList
                data={yearRows}
                keyExtractor={(_, ri) => `y-row-${ri}`}
                initialScrollIndex={yearInitialRowIndex}
                getItemLayout={(_, index) => ({
                  length: YEAR_ROW_HEIGHT,
                  offset: YEAR_ROW_HEIGHT * index,
                  index,
                })}
                showsVerticalScrollIndicator={false}
                style={styles.yearGrid}
                contentContainerStyle={styles.yearGridContent}
                renderItem={({ item: row, index: ri }) => (
                  <View style={styles.yearRow}>
                    {row.map((y, ci) => {
                      if (y < 0) {
                        return (
                          <View
                            key={`y-pad-${ri}-${ci}`}
                            style={[styles.yearChip, styles.yearChipSpacer]}
                          />
                        );
                      }
                      const isSelected = y === jumperYear;
                      return (
                        <TouchableOpacity
                          key={y}
                          onPress={() => pickYear(y)}
                          style={[
                            styles.yearChip,
                            { borderColor: isSelected ? colors.accent : colors.border },
                            isSelected && { backgroundColor: colors.accent + '22' },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${y}`}
                          accessibilityState={{ selected: isSelected }}>
                          <Text
                            style={[
                              styles.yearChipText,
                              { color: isSelected ? colors.accent : colors.textMuted },
                            ]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              />
            </>
          )}

          {/* ─── Page: MONTH ────────────────────────────────────────────── */}
          {page === 'month' && (
            <>
              <View style={styles.pageHeader}>
                <TouchableOpacity
                  onPress={goBack}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}>
                  <Icon name="chevron-left" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                  {jumperYear}
                </Text>
                <View style={styles.pageHeaderSpacer} />
              </View>

              <View style={styles.monthGrid}>
                {(t('panchang.monthNamesShort', { returnObjects: true }) as string[]).map((name, i) => {
                  const isCurrent = jumperYear === year && i === month;
                  const disabled = isMonthDisabled(jumperYear, i);
                  return (
                    <TouchableOpacity
                      key={i}
                      disabled={disabled}
                      style={[
                        styles.monthCell,
                        isCurrent && { backgroundColor: colors.accent },
                        disabled && { opacity: 0.35 },
                      ]}
                      onPress={() => pickMonth(i)}
                      accessibilityRole="button"
                      accessibilityLabel={name}
                      accessibilityState={{ selected: isCurrent, disabled }}>
                      <Text
                        style={[
                          styles.monthCellText,
                          { color: isCurrent ? colors.base : disabled ? colors.textDisabled : colors.textSecondary },
                        ]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const YEAR_CHIP_HEIGHT = 36;
const YEAR_ROW_GAP = 8;
const YEAR_ROW_HEIGHT = YEAR_CHIP_HEIGHT + YEAR_ROW_GAP;
const YEAR_GRID_VISIBLE_ROWS = 4;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,10,4,0.55)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 14,
  },
  title: { fontSize: 24, lineHeight: 30, textAlign: 'center' },
  rule: { marginTop: 8, marginBottom: 14, alignSelf: 'center', width: '50%' },

  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 11,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  monthLabel: { fontSize: 16, fontFamily: 'NotoSerifDevanagari_500Medium' },
  monthLabelDivider: { width: StyleSheet.hairlineWidth, height: 14 },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageHeaderLabel: { fontSize: 11 },
  pageHeaderSpacer: { width: 20 },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  monthCell: {
    flexBasis: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  monthCellText: { fontSize: 13, fontFamily: 'NotoSerifDevanagari_500Medium' },

  yearGrid: {
    maxHeight: YEAR_ROW_HEIGHT * YEAR_GRID_VISIBLE_ROWS,
  },
  yearGridContent: {
    paddingVertical: 4,
  },
  yearRow: {
    flexDirection: 'row',
    gap: YEAR_ROW_GAP,
    marginBottom: YEAR_ROW_GAP,
  },
  yearChip: {
    flex: 1,
    height: YEAR_CHIP_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearChipSpacer: { borderColor: 'transparent', backgroundColor: 'transparent' },
  yearChipText: { fontSize: 13, fontFamily: MONO_FONT, fontWeight: '500' },

  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0.5 },

  calGrid: { marginBottom: 16 },
  calRowGrid: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  cellInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dayNum: { fontSize: 14, fontFamily: MONO_FONT, fontWeight: '500' },

  bottomRow: { flexDirection: 'row', gap: 12 },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    alignItems: 'center',
  },
  bottomBtnPrimary: { borderWidth: 0 },
  bottomBtnText: { fontSize: 11 },

  doneBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.cardInner,
    alignItems: 'center',
  },
  doneText: { fontSize: 11 },
});
