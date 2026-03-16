import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { fetchPanchang } from '@/services/astrology/panchangService';
import { PanchangSkeleton } from '@/components/common/SkeletonLoader';
import type { IPanchangDay } from '@/types';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LimbRowProps {
  label: string;
  value: string;
  endTime?: string;
  colors: ColorPalette;
  isLast?: boolean;
}

function LimbRow({ label, value, endTime, colors, isLast }: LimbRowProps) {
  return (
    <>
      <View style={styles.limbRow}>
        <Text style={[styles.limbLabel, { color: colors.accent }]}>{label}</Text>
        <Text style={[styles.limbValue, { color: colors.textPrimary }]}>{value}</Text>
        {endTime && (
          <Text style={[styles.limbEndTime, { color: colors.textMuted }]}>Until {endTime}</Text>
        )}
      </View>
      {!isLast && <View style={[styles.limbDivider, { backgroundColor: colors.divider }]} />}
    </>
  );
}

interface SunCardProps {
  icon: 'sunny-outline' | 'moon-outline';
  label: string;
  time: string;
  colors: ColorPalette;
  iconColor: string;
}

function SunCard({ icon, label, time, colors, iconColor }: SunCardProps) {
  return (
    <View style={[styles.sunCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[styles.sunCardLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.sunCardTime, { color: colors.textPrimary }]}>{time}</Text>
    </View>
  );
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  pickerDate: Date;
  onPickDate: (d: Date) => void;
  pickerPanchang: IPanchangDay | null;
  pickerLoading: boolean;
  colors: ColorPalette;
}

function DatePickerOverlay({
  visible, onClose, pickerDate, onPickDate, pickerPanchang, pickerLoading, colors,
}: DatePickerProps) {
  const today = new Date();
  const [calMonth, setCalMonth] = useState(
    new Date(pickerDate.getFullYear(), pickerDate.getMonth(), 1)
  );

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const cells = buildCalendarCells(year, month);

  function prevMonth() {
    setCalMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCalMonth(new Date(year, month + 1, 1));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>

          {/* Month nav */}
          <View style={styles.pickerMonthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.pickerMonthLabel, { color: colors.textPrimary }]}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.calRow}>
            {DAY_HEADERS.map((d, i) => (
              <Text
                key={i}
                style={[
                  styles.calDayHeader,
                  { color: (i === 0 || i === 6) ? colors.textDisabled : colors.textMuted },
                ]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar cells */}
          <View style={styles.calGrid}>
            {cells.map((cell, idx) => {
              if (cell === null) return <View key={`blank-${idx}`} style={styles.calCell} />;
              const cellDate = new Date(year, month, cell);
              const isToday = isSameDay(cellDate, today);
              const isSelected = isSameDay(cellDate, pickerDate);
              const col = idx % 7;
              const isWeekend = col === 0 || col === 6;
              const textColor = isToday || isSelected
                ? colors.base
                : isWeekend ? colors.textDisabled : colors.textSecondary;

              return (
                <TouchableOpacity
                  key={cell}
                  style={styles.calCell}
                  onPress={() => onPickDate(cellDate)}>
                  <View style={[
                    styles.calCellInner,
                    isToday && { backgroundColor: colors.accent },
                    isSelected && !isToday && { backgroundColor: colors.accent + 'AA' },
                  ]}>
                    <Text style={[styles.calDayNum, { color: textColor }]}>{cell}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.pickerLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Today</Text>
          </View>

          {/* Mini panchang summary */}
          {pickerLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : pickerPanchang ? (
            <View style={[styles.miniGrid, { borderColor: colors.border }]}>
              <MiniCell label="TITHI" value={pickerPanchang.tithi} colors={colors} />
              <MiniCell label="NAKSHATRA" value={pickerPanchang.nakshatra} colors={colors} />
              <MiniCell label="YOGA" value={pickerPanchang.yoga} colors={colors} />
              <MiniCell label="KARANA" value={pickerPanchang.karana} colors={colors} />
            </View>
          ) : null}

          <TouchableOpacity
            onPress={onClose}
            style={[styles.pickerDoneBtn, { backgroundColor: colors.accent }]}>
            <Text style={[styles.pickerDoneText, { color: colors.base }]}>Done</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

function MiniCell({ label, value, colors }: { label: string; value: string; colors: ColorPalette }) {
  return (
    <View style={styles.miniCell}>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.miniValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PanchangScreen() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [panchang, setPanchang] = useState<IPanchangDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerPanchang, setPickerPanchang] = useState<IPanchangDay | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const loadPanchang = useCallback(async (date: Date) => {
    setLoading(true);
    setError(false);
    const result = await fetchPanchang(date);
    if (result) {
      setPanchang(result);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPanchang(selectedDate);
  }, [selectedDate, loadPanchang]);

  async function handlePickDate(date: Date) {
    setPickerDate(date);
    setPickerLoading(true);
    const result = await fetchPanchang(date);
    setPickerPanchang(result);
    setPickerLoading(false);
  }

  function handlePickerClose() {
    setShowPicker(false);
    if (!isSameDay(pickerDate, selectedDate)) {
      setSelectedDate(pickerDate);
    }
  }

  function openPicker() {
    setPickerDate(selectedDate);
    setPickerPanchang(panchang);
    setShowPicker(true);
  }

  const dateDay = selectedDate.getDate();
  const gregDate = selectedDate.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Panchang</Text>
        <View style={[styles.locationBadge, { backgroundColor: colors.surfaceRecessed }]}>
          <Ionicons name="location" size={10} color={colors.accent} />
          <Text style={[styles.locationText, { color: colors.textMuted }]}> Pune, MH (GPS)</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* Date display — tappable */}
        <TouchableOpacity
          onPress={openPicker}
          activeOpacity={0.7}
          style={styles.dateDisplay}>
          <Text style={[styles.dateTopLabel, { color: colors.textMuted }]}>
            {panchang
              ? `${panchang.hinduMonth ?? ''} · ${panchang.tithi}`.toUpperCase()
              : ' '}
          </Text>
          <Text style={[styles.dateBigNumber, { color: colors.accent }]}>{dateDay}</Text>
          <Text style={[styles.dateGregorian, { color: colors.textSecondary }]}>{gregDate}</Text>
          {panchang?.vikramSamvat && (
            <Text style={[styles.dateSamvat, { color: colors.textMuted }]}>
              VS SAMVAT {panchang.vikramSamvat}
            </Text>
          )}
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginTop: 4 }} />
        </TouchableOpacity>

        {loading ? (
          <PanchangSkeleton colors={colors} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <View style={[styles.errorIconCircle, { backgroundColor: colors.surfaceRecessed }]}>
              <Ionicons name="alert-circle-outline" size={28} color="#E24B4A" />
            </View>
            <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Calculation failed</Text>
            <Text style={[styles.errorDesc, { color: colors.textTertiary }]}>
              Unable to compute Panchang for this date. This may be due to an invalid date or location.
            </Text>
            <TouchableOpacity
              onPress={() => loadPanchang(selectedDate)}
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
              <Text style={[styles.retryText, { color: colors.base }]}>Retry</Text>
            </TouchableOpacity>
            <Text style={[styles.fallbackNote, { color: colors.textMuted }]}>
              Using fallback: Pune (18.63°N)
            </Text>
          </View>
        ) : panchang ? (
          <>
            {/* Pancha Anga card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LimbRow label="TITHI (LUNAR DAY)" value={panchang.tithi} endTime={panchang.tithiEndTime} colors={colors} />
              <LimbRow label="NAKSHATRA (LUNAR MANSION)" value={panchang.nakshatra} endTime={panchang.nakshatraEndTime} colors={colors} />
              <LimbRow label="YOGA (SUN-MOON COMBINATION)" value={panchang.yoga} endTime={panchang.yogaEndTime} colors={colors} />
              <LimbRow label="KARANA" value={panchang.karana} colors={colors} />
              <LimbRow label="VARA (DAY OF WEEK)" value={panchang.vara ?? selectedDate.toLocaleDateString('en-IN', { weekday: 'long' })} colors={colors} isLast />
            </View>

            {/* Sunrise / Sunset */}
            <View style={styles.sunRow}>
              <SunCard icon="sunny-outline" label="SUNRISE" time={panchang.sunrise} colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon-outline" label="SUNSET" time={panchang.sunset} colors={colors} iconColor={colors.textMuted} />
            </View>

            {/* Rahukaal bar */}
            {panchang.rahuKalamStart && panchang.rahuKalamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="warning-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>RAHUKAAL</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.rahuKalamStart} – {panchang.rahuKalamEnd}
                </Text>
              </View>
            )}
          </>
        ) : null}

      </ScrollView>

      <DatePickerOverlay
        visible={showPicker}
        onClose={handlePickerClose}
        pickerDate={pickerDate}
        onPickDate={handlePickDate}
        pickerPanchang={pickerPanchang}
        pickerLoading={pickerLoading}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 40, paddingTop: 8 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  screenTitle: { fontSize: 22, fontFamily: 'Mukta_500Medium' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.chip },
  locationText: { fontSize: 11, fontFamily: 'Mukta_400Regular' },

  // Date display
  dateDisplay: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  dateTopLabel: { fontSize: 13, fontFamily: 'Mukta_400Regular', letterSpacing: 0.8 },
  dateBigNumber: { fontSize: 42, fontFamily: 'Mukta_500Medium', lineHeight: 52 },
  dateGregorian: { fontSize: 14, fontFamily: 'Mukta_400Regular' },
  dateSamvat: { fontSize: 13, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },

  // Pancha Anga card
  card: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  limbRow: { paddingVertical: 12 },
  limbLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginBottom: 4 },
  limbValue: { fontSize: 17, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  limbEndTime: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
  limbDivider: { height: 0.5 },

  // Sun cards
  sunRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sunCard: { flex: 1, borderRadius: borderRadius.cardInner, borderWidth: 1, padding: 16, alignItems: 'center', gap: 6 },
  sunCardLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  sunCardTime: { fontSize: 16, fontFamily: 'Mukta_500Medium' },

  // Rahukaal
  rahuBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  rahuLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, flex: 1 },
  rahuTime: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  // Error
  errorContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  errorIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 16, fontFamily: 'Mukta_500Medium' },
  errorDesc: { fontSize: 13, fontFamily: 'Mukta_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: borderRadius.button, marginTop: 4 },
  retryText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  fallbackNote: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  // Date picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  pickerMonthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerMonthLabel: { fontSize: 16, fontFamily: 'Mukta_500Medium' },

  calRow: { flexDirection: 'row', marginBottom: 8 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Mukta_500Medium' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calCellInner: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  calDayNum: { fontSize: 14, fontFamily: 'Mukta_400Regular' },

  pickerLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: borderRadius.cardInner, padding: 12, gap: 8, marginBottom: 16 },
  miniCell: { width: '47%' },
  miniLabel: { fontSize: 10, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginBottom: 2 },
  miniValue: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  pickerDoneBtn: { borderRadius: borderRadius.button, paddingVertical: 14, alignItems: 'center' },
  pickerDoneText: { fontSize: 15, fontFamily: 'Mukta_700Bold' },
});
