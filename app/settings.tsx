import { useState, useEffect } from 'react';
import { View, Text as RNText, ScrollView, TouchableOpacity, Switch, Modal, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore, type FontSize, type MasaSystem, type Region } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { LANGUAGE_OPTIONS, resolveLanguage, changeLanguage, type AppLanguage } from '@/i18n';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleSunriseAlert,
  cancelSunriseAlert,
} from '@/services/notifications';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { ymd } from '@/utils/calendar';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    isDarkMode,
    toggleTheme,
    userLocation,
    locationName,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    dailyReminderEnabled,
    setDailyReminderEnabled,
    sunriseAlertEnabled,
    setSunriseAlertEnabled,
    masaSystem,
    setMasaSystem,
    region,
    setRegion,
    userBirthDate,
    setUserBirthDate,
    setWalkthroughStep,
    selectedDeities,
  } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const { t, i18n } = useTranslation();

  function handleLanguageChange(lang: AppLanguage) {
    setLanguage(lang);
    changeLanguage(resolveLanguage(lang));
  }

  const [sunriseTime, setSunriseTime] = useState<string | null>(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);

  // Fetch today's sunrise once (needed to schedule the sunrise alert)
  useEffect(() => {
    fetchPanchangForToday(userLocation).then((p) => {
      if (p?.sunrise && p.sunrise !== '—') setSunriseTime(p.sunrise);
    });
  }, [userLocation]);

  const locationText = locationName
    ? locationName
    : userLocation
      ? `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`
      : t('settings.usingDefault');

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDailyReminderToggle(val: boolean) {
    if (val) {
      const ok = await scheduleDailyReminder();
      if (!ok) {
        Alert.alert(
          t('settings.permissionRequired'),
          t('settings.permissionRequiredDesc'),
        );
        return;
      }
    } else {
      await cancelDailyReminder();
    }
    setDailyReminderEnabled(val);
  }

  function handleDobPick(date: Date) {
    setUserBirthDate(ymd(date));
  }

  function handleDobClear() {
    setUserBirthDate(null);
  }

  const userBirthDateObj = userBirthDate ? new Date(userBirthDate + 'T12:00:00') : null;
  const birthDateLabel = userBirthDateObj
    ? userBirthDateObj.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : t('settings.birthDateNotSet');

  async function handleSunriseAlertToggle(val: boolean) {
    if (val) {
      if (!sunriseTime) {
        Alert.alert(t('settings.sunriseUnavailable'), t('settings.sunriseUnavailableDesc'));
        return;
      }
      const ok = await scheduleSunriseAlert(sunriseTime);
      if (!ok) {
        Alert.alert(
          t('settings.permissionRequired'),
          t('settings.permissionRequiredDesc'),
        );
        return;
      }
    } else {
      await cancelSunriseAlert();
    }
    setSunriseAlertEnabled(val);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.title')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Language ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.language')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="globe"
            label={t('settings.appLanguage')}
            sublabel={LANGUAGE_OPTIONS.find(o => o.key === language)?.nativeLabel ?? t('settings.systemDefault')}
            colors={colors}
            right={
              <LanguagePicker value={language} onChange={handleLanguageChange} colors={colors} />
            }
          />
        </View>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.appearance')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="moon"
            label={t('settings.darkMode')}
            colors={colors}
            right={
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={isDarkMode ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          {/* Font Size — inline segmented picker */}
          <SettingRow
            icon="text"
            label={t('settings.fontSize')}
            sublabel={t(`settings.fontSize${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}` as any)}
            colors={colors}
            right={
              <FontSizePicker value={fontSize} onChange={setFontSize} colors={colors} />
            }
          />

        </View>

        {/* ── Calendar ─────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.calendar')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="calendar"
            label={t('settings.masaSystem')}
            sublabel={t('settings.masaSystemDesc')}
            colors={colors}
            right={
              <MasaSystemPicker value={masaSystem} onChange={setMasaSystem} colors={colors} />
            }
          />
        </View>

        {/* ── Location ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.location')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/location-permission')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.myLocation')}>
            <SettingRow
              icon="location"
              label={t('settings.gpsLocation')}
              sublabel={locationText}
              colors={colors}
              right={
                <View style={styles.locationRight}>
                  <View style={[styles.statusDot, { backgroundColor: userLocation ? '#5DCAA5' : colors.textMuted }]} />
                  <Icon name="chevron-right" size={14} color={colors.textMuted} />
                </View>
              }
            />
          </TouchableOpacity>
          <Divider colors={colors} />
          <RegionRow region={region} onChange={setRegion} colors={colors} />
        </View>

        {/* ── Deities ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.deities')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/settings/deities')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.manageDeities')}>
            <SettingRow
              icon="flower"
              label={t('settings.manageDeities')}
              sublabel={
                selectedDeities.length > 0
                  ? t('settings.manageDeitiesCount', { count: selectedDeities.length })
                  : t('settings.manageDeitiesNone')
              }
              colors={colors}
              right={<Icon name="chevron-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>
        </View>

        {/* ── Horoscope ─────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.horoscope')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setDobPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.birthDate')}>
            <SettingRow
              icon="gift"
              label={t('settings.birthDate')}
              sublabel={birthDateLabel}
              colors={colors}
              right={<Icon name="chevron-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>
        </View>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <SectionHeader label={t('settings.notifications')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="bell"
            label={t('settings.dailyReminder')}
            sublabel={t('settings.dailyReminderDesc')}
            colors={colors}
            right={
              <Switch
                value={dailyReminderEnabled}
                onValueChange={handleDailyReminderToggle}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={dailyReminderEnabled ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <SettingRow
            icon="sun"
            label={t('settings.sunriseAlert')}
            sublabel={sunriseTime ? t('settings.sunriseAlertAt', { time: sunriseTime }) : t('settings.sunriseAlertGeneric')}
            colors={colors}
            right={
              <Switch
                value={sunriseAlertEnabled}
                onValueChange={handleSunriseAlertToggle}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={sunriseAlertEnabled ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/settings/reminders')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.festivalTithiReminders')}>
            <SettingRow
              icon="alarm"
              label={t('settings.festivalTithiReminders')}
              sublabel={t('settings.festivalTithiRemindersDesc')}
              colors={colors}
              right={<Icon name="chevron-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.about')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.replayWalkthrough')}
            onPress={() => {
              setWalkthroughStep(1);
              router.back();
            }}>
            <SettingRow
              icon="walk"
              label={t('settings.replayWalkthrough')}
              sublabel={t('settings.replayWalkthroughDesc')}
              colors={colors}
              right={<Icon name="arrow-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

          <Divider colors={colors} />

          <SettingRow
            icon="apps"
            label={t('settings.appVersion')}
            sublabel={t('common.appNameHindi')}
            colors={colors}
            right={<Text variant="mono" style={[styles.versionText, { color: colors.textMuted }]}>v1.0.0</Text>}
          />

          <Divider colors={colors} />

          <SettingRow
            icon="heart-outline"
            label={t('settings.madeWithDevotion')}
            sublabel={t('settings.offlineFirst')}
            colors={colors}
            right={<Text style={{ fontSize: 18 }}>🙏</Text>}
          />

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal
        visible={dobPickerOpen}
        onClose={() => setDobPickerOpen(false)}
        value={userBirthDateObj}
        onPick={handleDobPick}
        onClear={handleDobClear}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        maxDate={new Date()}
        colors={colors}
        title={t('settings.birthDatePickerTitle')}
      />

    </SafeAreaView>
  );
}

// ─── Font Size Picker ─────────────────────────────────────────────────────────

interface FontSizePickerProps {
  value: FontSize;
  onChange: (size: FontSize) => void;
  colors: ColorPalette;
}

function FontSizePicker({ value, onChange, colors }: FontSizePickerProps) {
  const sizes: { fontSize: number; key: FontSize }[] = [
    { key: 'small', fontSize: 12 },
    { key: 'normal', fontSize: 15 },
    { key: 'large', fontSize: 19 },
    { key: 'xl', fontSize: 24 },
  ];
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {sizes.map(({ key, fontSize }, i) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.fontPickerBtn,
              i < sizes.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={key}
            accessibilityState={{ selected: active }}>
            <RNText style={[styles.fontPickerLabel, { fontSize, color: active ? '#FFFFFF' : colors.textSecondary }]}>
              A
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Language Picker ──────────────────────────────────────────────────────────

interface LanguagePickerProps {
  value: AppLanguage;
  onChange: (lang: AppLanguage) => void;
  colors: ColorPalette;
}

function LanguagePicker({ value, onChange, colors }: LanguagePickerProps) {
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {LANGUAGE_OPTIONS.map(({ key, nativeLabel }, i) => {
        const active = value === key;
        const label = key === 'system' ? '📱' : nativeLabel.slice(0, 2);
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.langPickerBtn,
              i < LANGUAGE_OPTIONS.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={nativeLabel}
            accessibilityState={{ selected: active }}>
            <RNText style={[styles.langPickerLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {label}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Masa System Picker ─────────────────────────────────────────────────────

interface MasaSystemPickerProps {
  value: MasaSystem;
  onChange: (system: MasaSystem) => void;
  colors: ColorPalette;
}

const MASA_OPTIONS: { key: MasaSystem; tKey: string }[] = [
  { key: 'purnimanta', tKey: 'panchang.purnimanta' },
  { key: 'amanta', tKey: 'panchang.amanta' },
];

function MasaSystemPicker({ value, onChange, colors }: MasaSystemPickerProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {MASA_OPTIONS.map(({ key, tKey }, i) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.masaPickerBtn,
              i < MASA_OPTIONS.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t(tKey)}
            accessibilityState={{ selected: active }}>
            <RNText style={[styles.langPickerLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {t(tKey)}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Region Row ─────────────────────────────────────────────────────────────

interface RegionGroup {
  key: 'south' | 'east' | 'west' | 'north' | 'international';
  regions: Region[];
}

// "All India" is a standalone top entry; the other 21 states are grouped by
// cardinal direction following the FestivalRegion ordering in panchang-ts v2.1.
const REGION_GROUPS: RegionGroup[] = [
  { key: 'south', regions: ['tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana'] },
  { key: 'east', regions: ['west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand'] },
  { key: 'west', regions: ['gujarat', 'maharashtra', 'goa', 'rajasthan'] },
  { key: 'north', regions: ['punjab', 'haryana', 'himachal-pradesh', 'uttarakhand', 'uttar-pradesh', 'madhya-pradesh'] },
  { key: 'international', regions: ['nepal'] },
];

function RegionRow({
  region, onChange, colors,
}: { region: Region; onChange: (r: Region) => void; colors: ColorPalette }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  function tr(r: Region): string {
    return t(`settings.regionOptions.${r}`);
  }

  function renderRegionItem(r: Region) {
    const active = r === region;
    return (
      <TouchableOpacity
        key={r}
        activeOpacity={0.7}
        onPress={() => { onChange(r); setOpen(false); }}
        style={[
          styles.regionItem,
          { borderBottomColor: colors.divider },
          active && { backgroundColor: colors.accent + '18' },
        ]}
        accessibilityRole="button"
        accessibilityLabel={tr(r)}
        accessibilityState={{ selected: active }}>
        <Text variant="body" style={[styles.regionItemLabel, { color: active ? colors.accent : colors.textPrimary }]}>
          {tr(r)}
        </Text>
        {active && <Icon name="check" size={18} color={colors.accent} />}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('settings.region')}>
        <SettingRow
          icon="compass"
          label={t('settings.region')}
          sublabel={t('settings.regionDesc')}
          colors={colors}
          right={
            <View style={styles.regionRight}>
              <Text variant="body-italic" style={[styles.regionValue, { color: colors.textPrimary }]}>{tr(region)}</Text>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </View>
          }
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.regionOverlay}>
          <View style={[styles.regionSheet, { backgroundColor: colors.surface }]}>
            <Text variant="display-italic" style={[styles.regionSheetTitle, { color: colors.textPrimary }]}>
              {t('settings.regionPickerTitle')}
            </Text>
            <ScrollView
              style={styles.regionScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}>
              {/* "All India" stays at the top, ungrouped. */}
              {renderRegionItem('all')}

              {REGION_GROUPS.map(group => (
                <View key={group.key}>
                  <Text variant="mono-caps" style={[styles.regionGroupHeader, { color: colors.textMuted }]}>
                    {t(`settings.regionGroup.${group.key}`)}
                  </Text>
                  {group.regions.map(renderRegionItem)}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={[styles.pickerDoneBtn, { backgroundColor: palette.sindoor, marginTop: 12 }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}>
              <Text variant="mono-caps" style={[styles.pickerDoneText, { color: palette.parchmentBright }]}>
                {t('common.done')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  colors: ColorPalette;
}

function SectionHeader({ label }: SectionHeaderProps) {
  return <SectionLabel style={styles.sectionHeader}>{label}</SectionLabel>;
}

interface SettingRowProps {
  icon: IconName;
  label: string;
  sublabel?: string;
  colors: ColorPalette;
  right?: React.ReactNode;
}

function SettingRow({ icon, label, sublabel, colors, right }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && (
          <Text variant="body-italic" style={[styles.rowSublabel, { color: colors.textTertiary }]} numberOfLines={1}>
            {sublabel}
          </Text>
        )}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider({ colors }: { colors: ColorPalette }) {
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22 },

  // Scroll
  scroll: { paddingTop: 8, paddingBottom: 32 },

  // Section label
  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, lineHeight: 20 },
  rowSublabel: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  // Status dot
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  locationRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Region picker
  regionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  regionValue: { fontSize: 13 },
  regionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  regionSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  regionSheetTitle: { fontSize: 20, marginBottom: 14, textAlign: 'center' },
  regionScroll: { flexShrink: 1 },
  regionGroupHeader: {
    fontSize: 10,
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 14,
  },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  regionItemLabel: { fontSize: 15 },
  pickerDoneBtn: { borderRadius: borderRadius.button, paddingVertical: 14, alignItems: 'center' },
  pickerDoneText: { fontSize: 11 },

  // Version text
  versionText: { fontSize: 12 },

  // Font size picker
  fontPicker: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fontPickerBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontPickerLabel: {
    fontFamily: 'Fraunces_500Medium',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Language picker
  langPickerBtn: {
    paddingHorizontal: 10,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langPickerLabel: {
    fontSize: 13,
    fontFamily: 'NotoSerifDevanagari_500Medium',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Masa system picker
  masaPickerBtn: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
