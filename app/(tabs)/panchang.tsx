import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { fetchPanchang } from '@/services/astrology/panchangService';
import { usePanchang } from '@/hooks/usePanchang';
import { PanchangSkeleton } from '@/components/common/SkeletonLoader';
import { AdBanner } from '@/components/common/AdBanner';
import { QualitySlotsCard } from '@/components/panchang/QualitySlotsCard';
import { HoraCard } from '@/components/panchang/HoraCard';
import { PlanetaryPositionsCard } from '@/components/panchang/PlanetaryPositionsCard';
import type { IPanchangDay, IPanchangElement, IQualitySlot } from '@/types';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const YEAR_MIN = 2016;
const YEAR_MAX = 2036;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

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
  elements: IPanchangElement[];
  colors: ColorPalette;
  isLast?: boolean;
}

function LimbRow({ label, elements, colors, isLast }: LimbRowProps) {
  return (
    <>
      <View style={styles.limbRow}>
        <Text style={[styles.limbLabel, { color: colors.accent }]}>{label}</Text>
        {elements.map((el, i) => (
          <View key={i} style={i > 0 ? styles.limbSecondary : undefined}>
            <Text style={[styles.limbValue, { color: colors.textPrimary }]}>{el.name}</Text>
            {el.endTime && (
              <Text style={[styles.limbEndTime, { color: colors.textMuted }]}>Until {el.endTime}</Text>
            )}
          </View>
        ))}
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
  const [showJumper, setShowJumper] = useState(false);
  const [jumperYear, setJumperYear] = useState(calMonth.getFullYear());

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const cells = buildCalendarCells(year, month);

  function prevMonth() {
    setCalMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCalMonth(new Date(year, month + 1, 1));
  }

  function openJumper() {
    setJumperYear(year);
    setShowJumper(true);
  }

  function pickMonthYear(m: number) {
    setCalMonth(new Date(jumperYear, m, 1));
    setShowJumper(false);
  }

  function goToToday() {
    setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setShowJumper(false);
    onPickDate(today);
  }

  const isViewingToday = isSameDay(pickerDate, today) && year === today.getFullYear() && month === today.getMonth();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>

          {showJumper ? (
            <>
              {/* Year selector */}
              <View style={styles.pickerMonthRow}>
                <TouchableOpacity onPress={() => setJumperYear(Math.max(YEAR_MIN, jumperYear - 1))} hitSlop={12}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.pickerMonthLabel, { color: colors.textPrimary }]}>
                  {jumperYear}
                </Text>
                <TouchableOpacity onPress={() => setJumperYear(Math.min(YEAR_MAX, jumperYear + 1))} hitSlop={12}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Month grid */}
              <View style={styles.monthGrid}>
                {MONTH_NAMES_SHORT.map((name, i) => {
                  const isCurrent = jumperYear === year && i === month;
                  const isThisMonth = jumperYear === today.getFullYear() && i === today.getMonth();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.monthCell,
                        isThisMonth && { backgroundColor: colors.accent },
                        isCurrent && !isThisMonth && { backgroundColor: colors.accent + 'AA' },
                      ]}
                      onPress={() => pickMonthYear(i)}>
                      <Text style={[
                        styles.monthCellText,
                        { color: (isThisMonth || isCurrent) ? colors.base : colors.textSecondary },
                      ]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Year list for quick jump */}
              <FlatList
                data={YEARS}
                keyExtractor={(item) => item.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.yearList}
                initialScrollIndex={Math.max(0, jumperYear - YEAR_MIN - 2)}
                getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
                renderItem={({ item: y }) => (
                  <TouchableOpacity
                    onPress={() => setJumperYear(y)}
                    style={[
                      styles.yearChip,
                      { borderColor: y === jumperYear ? colors.accent : colors.border },
                      y === jumperYear && { backgroundColor: colors.accent + '22' },
                    ]}>
                    <Text style={[
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
                style={[styles.pickerDoneBtn, { backgroundColor: colors.accent, marginTop: 16 }]}>
                <Text style={[styles.pickerDoneText, { color: colors.base }]}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Month nav */}
              <View style={styles.pickerMonthRow}>
                <TouchableOpacity onPress={prevMonth} hitSlop={12}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={openJumper} hitSlop={8}>
                  <Text style={[styles.pickerMonthLabel, { color: colors.textPrimary }]}>
                    {MONTH_NAMES[month]} {year}  <Ionicons name="caret-down" size={12} color={colors.textMuted} />
                  </Text>
                </TouchableOpacity>
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

              {/* Today button */}
              {!isViewingToday && (
                <View style={styles.todayBtnRow}>
                  <TouchableOpacity onPress={goToToday} activeOpacity={0.7} style={[styles.todayBtn, { backgroundColor: colors.accent }]}>
                    <Ionicons name="return-down-back" size={14} color={colors.base} />
                    <Text style={[styles.todayBtnText, { color: colors.base }]}>Jump to Today</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Mini panchang summary */}
              {pickerPanchang ? (
                <View style={{ opacity: pickerLoading ? 0.4 : 1 }}>
                  {pickerPanchang.festivals.length > 0 && (
                    <View style={[styles.miniFestivalBar, { backgroundColor: '#FFF8E1', borderColor: '#F9A825' }]}>
                      <Ionicons name="star" size={13} color="#F9A825" />
                      <Text style={[styles.miniFestivalText, { color: '#F57F17' }]}>
                        {pickerPanchang.festivals.map(f => f.name).join(', ')}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.miniGrid, { borderColor: colors.border }]}>
                    <MiniCell label="TITHI" value={pickerPanchang.tithis[0]?.name ?? ''} colors={colors} />
                    <MiniCell label="NAKSHATRA" value={pickerPanchang.nakshatras[0]?.name ?? ''} colors={colors} />
                    <MiniCell label="YOGA" value={pickerPanchang.yogas[0]?.name ?? ''} colors={colors} />
                    <MiniCell label="KARANA" value={pickerPanchang.karanas[0]?.name ?? ''} colors={colors} />
                  </View>
                </View>
              ) : pickerLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
              ) : null}

              <TouchableOpacity
                onPress={onClose}
                style={[styles.pickerDoneBtn, { backgroundColor: colors.accent }]}>
                <Text style={[styles.pickerDoneText, { color: colors.base }]}>Done</Text>
              </TouchableOpacity>
            </>
          )}

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

function SectionHeader({ title, colors }: { title: string; colors: ColorPalette }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.accent }]}>{title}</Text>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PanchangScreen() {
  const { isDarkMode, userLocation } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const { panchang, loading, error, retry } = usePanchang(selectedDate, userLocation);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerPanchang, setPickerPanchang] = useState<IPanchangDay | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  async function handlePickDate(date: Date) {
    setPickerDate(date);
    setPickerLoading(true);
    const result = await fetchPanchang(date, userLocation);
    setPickerLoading(false);
    setPickerPanchang(result);
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
          <Text style={[styles.locationText, { color: colors.textMuted }]}>
            {userLocation
              ? ` ${userLocation.lat.toFixed(2)}°N, ${userLocation.lon.toFixed(2)}°E`
              : ' Pune, MH (default)'}
          </Text>
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
              ? `${panchang.hinduMonth ?? ''} · ${panchang.tithis[0]?.name ?? ''}`.toUpperCase()
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
              onPress={retry}
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
              <Text style={[styles.retryText, { color: colors.base }]}>Retry</Text>
            </TouchableOpacity>
            <Text style={[styles.fallbackNote, { color: colors.textMuted }]}>
              Using fallback: Pune (18.63°N)
            </Text>
          </View>
        ) : panchang ? (
          <>
            {/* ── Banners (festivals, special yogas, panchaka) ── */}
            {panchang.festivals.length > 0 && panchang.festivals.map((f, i) => (
              <View key={i} style={[styles.panchakaBar, { backgroundColor: '#FFF8E1', borderColor: '#F9A825' }]}>
                <Ionicons name="star" size={14} color="#F9A825" />
                <Text style={[styles.panchakaText, { color: '#F57F17' }]}>{f.name}</Text>
              </View>
            ))}
            {panchang.specialYogas.length > 0 && panchang.specialYogas.map((y, i) => (
              <View key={i} style={[styles.panchakaBar, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                <Ionicons name="sparkles" size={14} color="#4CAF50" />
                <Text style={[styles.panchakaText, { color: '#2E7D32' }]}>{y.name}</Text>
              </View>
            ))}
            {panchang.panchaka && (
              <View style={[styles.panchakaBar, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
                <Ionicons name="alert-circle-outline" size={15} color="#FF9800" />
                <Text style={[styles.panchakaText, { color: '#E65100' }]}>PANCHAKA — Moon in last 5 nakshatras</Text>
              </View>
            )}

            {/* ── Pancha Anga card ── */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LimbRow label="TITHI (LUNAR DAY)" elements={panchang.tithis} colors={colors} />
              <LimbRow label="NAKSHATRA (LUNAR MANSION)" elements={panchang.nakshatras} colors={colors} />
              <LimbRow label="YOGA (SUN-MOON COMBINATION)" elements={panchang.yogas} colors={colors} />
              <LimbRow label="KARANA" elements={panchang.karanas} colors={colors} />
              <LimbRow label="VARA (DAY OF WEEK)" elements={[{ name: panchang.vara ?? selectedDate.toLocaleDateString('en-IN', { weekday: 'long' }) }]} colors={colors} />
              {panchang.chandraRashi && (
                <LimbRow label="CHANDRA RASHI (MOON SIGN)" elements={[{ name: panchang.chandraRashi }]} colors={colors} />
              )}
              {panchang.suryaNakshatra && (
                <LimbRow label="SURYA NAKSHATRA (SUN'S ASTERISM)" elements={[{ name: panchang.suryaNakshatra }]} colors={colors} />
              )}
              {panchang.masa && (
                <LimbRow label="MASA (SOLAR MONTH)" elements={[{ name: panchang.masa }]} colors={colors} isLast />
              )}
            </View>

            {/* ── Sun / Moon times ── */}
            <View style={styles.sunGrid}>
              <SunCard icon="sunny-outline" label="SUNRISE"  time={panchang.sunrise}         colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon-outline"  label="SUNSET"   time={panchang.sunset}          colors={colors} iconColor={colors.textMuted} />
              <SunCard icon="moon-outline"  label="MOONRISE" time={panchang.moonrise ?? '—'} colors={colors} iconColor={colors.accent} />
              <SunCard icon="moon-outline"  label="MOONSET"  time={panchang.moonset  ?? '—'} colors={colors} iconColor={colors.textMuted} />
            </View>

            {/* Day / Night duration */}
            <View style={[styles.durationRow, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
              <View style={styles.durationCell}>
                <Ionicons name="sunny-outline" size={13} color={colors.accent} />
                <Text style={[styles.durationText, { color: colors.textMuted }]}>Day </Text>
                <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{formatDuration(panchang.dayDurationMinutes)}</Text>
              </View>
              <View style={[styles.durationDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.durationCell}>
                <Ionicons name="moon-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.durationText, { color: colors.textMuted }]}>Night </Text>
                <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{formatDuration(panchang.nightDurationMinutes)}</Text>
              </View>
            </View>

            {/* ── Auspicious Times ── */}
            <SectionHeader title="AUSPICIOUS TIMES" colors={colors} />

            {panchang.brahmaMuhurtaStart && panchang.brahmaMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="sparkles-outline" size={16} color="#4CAF50" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>BRAHMA MUHURTA</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.brahmaMuhurtaStart} – {panchang.brahmaMuhurtaEnd}
                </Text>
              </View>
            )}
            {panchang.abhijitMuhurtaStart && panchang.abhijitMuhurtaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="sparkles-outline" size={16} color="#4CAF50" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>ABHIJIT MUHURTA</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.abhijitMuhurtaStart} – {panchang.abhijitMuhurtaEnd}
                </Text>
              </View>
            )}

            {/* ── Inauspicious Times ── */}
            <SectionHeader title="INAUSPICIOUS TIMES" colors={colors} />

            {panchang.rahuKalamStart && panchang.rahuKalamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="warning-outline" size={16} color="#F44336" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>RAHU KALAM</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.rahuKalamStart} – {panchang.rahuKalamEnd}
                </Text>
              </View>
            )}
            {panchang.yamagandaStart && panchang.yamagandaEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="warning-outline" size={16} color="#F44336" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>YAMAGANDA</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.yamagandaStart} – {panchang.yamagandaEnd}
                </Text>
              </View>
            )}
            {panchang.gulikaKalamStart && panchang.gulikaKalamEnd && (
              <View style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="warning-outline" size={16} color="#F44336" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>GULIKA KALAM</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {panchang.gulikaKalamStart} – {panchang.gulikaKalamEnd}
                </Text>
              </View>
            )}
            {panchang.durMuhurta.map((dm, i) => (
              <View key={i} style={[styles.rahuBar, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Ionicons name="warning-outline" size={16} color="#F44336" />
                <Text style={[styles.rahuLabel, { color: colors.textMuted }]}>DUR MUHURTA</Text>
                <Text style={[styles.rahuTime, { color: colors.textPrimary }]}>
                  {dm.start} – {dm.end}
                </Text>
              </View>
            ))}

            {/* ── Time Slots ── */}
            <SectionHeader title="TIME QUALITY" colors={colors} />

            <QualitySlotsCard label="CHOGHADIYA" slots={panchang.choghadiya} colors={colors} />
            <QualitySlotsCard label="GOWRI PANCHANGAM" slots={panchang.gowriPanchangam} colors={colors} />
            <HoraCard slots={panchang.hora} colors={colors} />

            {/* ── Planetary Positions ── */}
            {panchang.planetaryPositions && panchang.planetaryPositions.length > 0 && (
              <>
                <SectionHeader title="PLANETARY POSITIONS" colors={colors} />
                <PlanetaryPositionsCard positions={panchang.planetaryPositions} colors={colors} />
              </>
            )}
          </>
        ) : null}

      </ScrollView>

      <AdBanner colors={colors} />

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
  limbSecondary: { marginTop: 8 },
  limbValue: { fontSize: 17, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  limbEndTime: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
  limbDivider: { height: 0.5 },

  // Sun / Moon grid (2×2)
  sunGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  sunRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sunCard: { width: '47%', borderRadius: borderRadius.cardInner, borderWidth: 1, padding: 16, alignItems: 'center', gap: 6 },
  sunCardLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5 },
  sunCardTime: { fontSize: 16, fontFamily: 'Mukta_500Medium' },

  // Panchaka
  panchakaBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  panchakaText: { fontSize: 12, fontFamily: 'Mukta_500Medium', flex: 1 },

  // Rahukaal / Brahma Muhurta
  rahuBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  rahuLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, flex: 1 },
  rahuTime: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  // Section header
  sectionHeader: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },

  // Day/night duration row
  durationRow: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.cardInner, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  durationCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  durationDivider: { width: 0.5, height: 16 },
  durationText: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
  durationValue: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

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

  todayBtnRow: { alignItems: 'center', marginBottom: 14 },
  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: borderRadius.chip, paddingHorizontal: 14, paddingVertical: 6 },
  todayBtnText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  miniFestivalBar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: borderRadius.cardInner, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  miniFestivalText: { fontSize: 12, fontFamily: 'Mukta_500Medium', flex: 1 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: borderRadius.cardInner, padding: 12, gap: 8, marginBottom: 16 },
  miniCell: { width: '47%' },
  miniLabel: { fontSize: 10, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginBottom: 2 },
  miniValue: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  pickerDoneBtn: { borderRadius: borderRadius.button, paddingVertical: 14, alignItems: 'center' },
  pickerDoneText: { fontSize: 15, fontFamily: 'Mukta_700Bold' },

  // Month-year jumper
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 16, marginTop: 8 },
  monthCell: { width: '28%', paddingVertical: 12, borderRadius: borderRadius.cardInner, alignItems: 'center' },
  monthCellText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },
  yearList: { paddingVertical: 8, gap: 8 },
  yearChip: { width: 56, paddingVertical: 6, borderRadius: borderRadius.chip, borderWidth: 1, alignItems: 'center' },
  yearChipText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },
});
