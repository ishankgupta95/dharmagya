import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { buildCalendarCells, isSameDay } from '@/utils/calendar';
import { borderRadius, type ColorPalette } from '@/config/theme';

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
                <TouchableOpacity onPress={() => setJumperYear(Math.max(minYear, jumperYear - 1))} hitSlop={12}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                  {jumperYear}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const cap = maxDate ? Math.min(maxYear, maxDate.getFullYear()) : maxYear;
                    setJumperYear(Math.min(cap, jumperYear + 1));
                  }}
                  hitSlop={12}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
                      onPress={() => pickMonthYear(i)}>
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
                    ]}>
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
                style={[styles.doneBtn, { backgroundColor: colors.accent, marginTop: 16 }]}>
                <Text style={[styles.doneText, { color: colors.base }]}>{t('common.back')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Month nav */}
              <View style={styles.monthRow}>
                <TouchableOpacity onPress={prevMonth} hitSlop={12} disabled={!canPrev}>
                  <Ionicons name="chevron-back" size={20} color={canPrev ? colors.textSecondary : colors.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity onPress={openJumper} hitSlop={8}>
                  <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                    {(t('panchang.monthNames', { returnObjects: true }) as string[])[month]} {year}  <Ionicons name="caret-down" size={12} color={colors.textMuted} />
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={nextMonth} hitSlop={12} disabled={!canNext}>
                  <Ionicons name="chevron-forward" size={20} color={canNext ? colors.textSecondary : colors.textDisabled} />
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

              {/* Calendar cells */}
              <View style={styles.calGrid}>
                {cells.map((cell, idx) => {
                  if (cell === null) return <View key={`blank-${idx}`} style={styles.cell} />;
                  const cellDate = new Date(year, month, cell);
                  const isSelected = value ? isSameDay(cellDate, value) : false;
                  const col = idx % 7;
                  const isWeekend = col === 0 || col === 6;
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
                      onPress={() => handlePick(cellDate)}>
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
              </View>

              <View style={styles.bottomRow}>
                {onClear && (
                  <TouchableOpacity
                    onPress={() => { onClear(); onClose(); }}
                    style={[styles.bottomBtn, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                    <Text style={[styles.bottomBtnText, { color: colors.textSecondary }]}>{t('common.clear', { defaultValue: 'Clear' })}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.bottomBtn, styles.bottomBtnPrimary, { backgroundColor: colors.accent }]}>
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
  title: { fontSize: 16, fontFamily: 'Mukta_500Medium', marginBottom: 12, textAlign: 'center' },

  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthLabel: { fontSize: 16, fontFamily: 'Mukta_500Medium' },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  monthCell: {
    flexBasis: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  monthCellText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

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
  yearChipText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 0.5 },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  cellInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dayNum: { fontSize: 14, fontFamily: 'Mukta_500Medium' },

  bottomRow: { flexDirection: 'row', gap: 12 },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    alignItems: 'center',
  },
  bottomBtnPrimary: { borderWidth: 0 },
  bottomBtnText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },

  doneBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.cardInner,
    alignItems: 'center',
  },
  doneText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
});
