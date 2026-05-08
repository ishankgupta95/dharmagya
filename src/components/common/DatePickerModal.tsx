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
import { buildCalendarCells, isSameDay } from '@/utils/calendar';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
import { borderRadius, MONO_FONT, type ColorPalette } from '@/config/theme';

/**
 * Reusable date-picker modal. Same visual pattern as the Panchang date picker
 * (month grid + month/year jumper), but stripped of panchang-specific concerns
 * so it can be reused anywhere we need plain date selection.
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
   * Upper-bound date (inclusive). Cells after this date are disabled.
   * Use e.g. `new Date()` for a DOB picker so the user can't pick a future
   * birthday. If omitted, only the year range enforces bounds.
   */
  maxDate?: Date;
  colors: ColorPalette;
  /** Header title to display. */
  title?: string;
}

export function DatePickerModal({
  visible,
  onClose,
  value,
  onPick,
  onClear,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  maxDate,
  colors,
  title,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const initial = value ?? new Date();
  const [calMonth, setCalMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const [showJumper, setShowJumper] = useState(false);
  const [jumperYear, setJumperYear] = useState(calMonth.getFullYear());

  // Re-sync internal state whenever the modal becomes visible, so reopening
  // after a saved DOB lands on the saved month instead of today's month.
  // Also resets the year-jumper view so users don't land in a sub-view from
  // a previous dismissal.
  useEffect(() => {
    if (!visible) return;
    const base = value ?? new Date();
    setCalMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setJumperYear(base.getFullYear());
    setShowJumper(false);
  }, [visible, value]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const years = useMemo(() => {
    const cap = maxDate ? Math.min(maxYear, maxDate.getFullYear()) : maxYear;
    const count = cap - minYear + 1;
    return Array.from({ length: count }, (_, i) => cap - i);
  }, [minYear, maxYear, maxDate]);

  function prevMonth() {
    const next = new Date(year, month - 1, 1);
    if (next.getFullYear() < minYear) return;
    setCalMonth(next);
  }

  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    if (next.getFullYear() > maxYear) return;
    if (maxDate && next > startOfMonth(maxDate)) return;
    setCalMonth(next);
  }

  function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function isMonthDisabled(y: number, m: number) {
    if (!maxDate) return false;
    return new Date(y, m, 1) > startOfMonth(maxDate);
  }

  function openJumper() {
    setJumperYear(year);
    setShowJumper(true);
  }

  function pickMonthYear(m: number) {
    setCalMonth(new Date(jumperYear, m, 1));
    setShowJumper(false);
  }

  function handlePick(date: Date) {
    onPick(date);
    onClose();
  }

  const canPrev = year > minYear || month > 0;
  const canNext = (year < maxYear || month < 11) && !isMonthDisabled(year, month + 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>

          {title && !showJumper && (
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          )}

          {showJumper ? (
            <>
              {/* Year selector */}
              <View style={styles.monthRow}>
                <TouchableOpacity
                  onPress={() => setJumperYear(Math.max(minYear, jumperYear - 1))}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`${jumperYear - 1}`}>
                  <Icon name="chevron-left" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                  {jumperYear}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const cap = maxDate ? Math.min(maxYear, maxDate.getFullYear()) : maxYear;
                    setJumperYear(Math.min(cap, jumperYear + 1));
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`${jumperYear + 1}`}>
                  <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Month grid */}
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
                      onPress={() => pickMonthYear(i)}
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

              {/* Year list for quick jump (newest first) */}
              <FlatList
                data={years}
                keyExtractor={(item) => item.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.yearList}
                initialScrollIndex={Math.max(0, years.indexOf(jumperYear) - 2)}
                getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
                renderItem={({ item: y }) => (
                  <TouchableOpacity
                    onPress={() => setJumperYear(y)}
                    style={[
                      styles.yearChip,
                      { borderColor: y === jumperYear ? colors.accent : colors.border },
                      y === jumperYear && { backgroundColor: colors.accent + '22' },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${y}`}
                    accessibilityState={{ selected: y === jumperYear }}>
                    <Text
                      style={[
                        styles.yearChipText,
                        { color: y === jumperYear ? colors.accent : colors.textMuted },
                      ]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity
                onPress={() => setShowJumper(false)}
                style={[styles.doneBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}>
                <Text style={[styles.doneText, { color: colors.base }]}>{t('common.back')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Month nav */}
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
                  onPress={openJumper}
                  hitSlop={8}
                  style={styles.monthLabelRow}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.openDatePicker')}>
                  <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                    {(t('panchang.monthNames', { returnObjects: true }) as string[])[month]} {year}
                  </Text>
                  <Icon name="caret-down" size={12} color={colors.textMuted} />
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
                      const textColor = isSelected
                        ? colors.base
                        : isFuture ? colors.textDisabled
                        : isWeekend ? colors.textDisabled : colors.textSecondary;
                      return (
                        <TouchableOpacity
                          key={cell}
                          style={styles.cell}
                          disabled={isFuture}
                          onPress={() => handlePick(cellDate)}
                          accessibilityRole="button"
                          accessibilityLabel={cellDate.toDateString()}
                          accessibilityState={{ selected: isSelected, disabled: isFuture }}>
                          <View style={[
                            styles.cellInner,
                            isSelected && { backgroundColor: colors.accent },
                            isFuture && { opacity: 0.35 },
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
                    <Text style={[styles.bottomBtnText, { color: colors.textSecondary }]}>{t('common.clear', { defaultValue: 'Clear' })}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.bottomBtn, styles.bottomBtnPrimary, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.done')}>
                  <Text style={[styles.bottomBtnText, { color: colors.base }]}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  title: { fontSize: 16, fontFamily: 'NotoSerifDevanagari_500Medium', marginBottom: 12, textAlign: 'center' },

  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthLabel: { fontSize: 16, fontFamily: 'NotoSerifDevanagari_500Medium' },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  monthCell: {
    flexBasis: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  monthCellText: { fontSize: 13, fontFamily: 'NotoSerifDevanagari_500Medium' },

  yearList: { paddingVertical: 4, gap: 8 },
  yearChip: {
    width: 60,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
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
  bottomBtnText: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_500Medium' },

  doneBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.cardInner,
    alignItems: 'center',
  },
  doneText: { fontSize: 14, fontFamily: 'NotoSerifDevanagari_500Medium' },
});
