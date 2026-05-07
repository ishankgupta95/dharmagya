import { useState, useEffect } from 'react';
import { View, Text as RNText, ScrollView, TouchableOpacity, Switch, Modal, StyleSheet, Alert, Linking, TextInput } from 'react-native';
import Constants from 'expo-constants';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore, type Ayanamsa, type ChartStyle, type FontSize, type HouseSystem, type MasaSystem, type Region, type Sex, type ThemeMode, type TimeFormat } from '@/store/useStore';
import { requestRating, shareApp } from '@/utils/share';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ScreenMount } from '@/components/common/ScreenMount';
import { LANGUAGE_OPTIONS, resolveLanguage, changeLanguage, type AppLanguage } from '@/i18n';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleSunriseAlert,
  cancelSunriseAlert,
} from '@/services/notifications';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { useLocaleFormatters } from '@/utils/format';
import { ymd } from '@/utils/calendar';

const SUNRISE_OFFSET_OPTIONS: { key: string; min: number }[] = [
  { key: '0', min: 0 },
  { key: '5', min: 5 },
  { key: '10', min: 10 },
  { key: '15', min: 15 },
  { key: '30', min: 30 },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    isDarkMode,
    themeMode,
    setThemeMode,
    userLocation,
    locationName,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    ayanamsa,
    setAyanamsa,
    chartStyle,
    setChartStyle,
    houseSystem,
    setHouseSystem,
    dailyReminderEnabled,
    setDailyReminderEnabled,
    dailyReminderTime,
    setDailyReminderTime,
    sunriseAlertEnabled,
    setSunriseAlertEnabled,
    sunriseAlertOffsetMin,
    setSunriseAlertOffsetMin,
    useDevanagariNumerals,
    setUseDevanagariNumerals,
    timeFormat,
    setTimeFormat,
    quietHoursEnabled,
    setQuietHoursEnabled,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
    showVikramSamvat,
    setShowVikramSamvat,
    masaSystem,
    setMasaSystem,
    region,
    setRegion,
    userBirthDate,
    setUserBirthDate,
    userBirthTime,
    setUserBirthTime,
    userBirthPlace,
    userSex,
    setUserSex,
    userName,
    setUserName,
    setWalkthroughStep,
    selectedDeities,
  } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const { t, i18n } = useTranslation();
  const { formatTime: formatDisplayTime } = useLocaleFormatters();

  function handleLanguageChange(lang: AppLanguage) {
    setLanguage(lang);
    changeLanguage(resolveLanguage(lang));
  }

  const [sunriseTime, setSunriseTime] = useState<string | null>(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [masaSheetOpen, setMasaSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [dailyTimePickerOpen, setDailyTimePickerOpen] = useState(false);
  const [sunriseOffsetSheetOpen, setSunriseOffsetSheetOpen] = useState(false);
  const [birthTimePickerOpen, setBirthTimePickerOpen] = useState(false);
  const [timeFormatSheetOpen, setTimeFormatSheetOpen] = useState(false);
  const [quietStartPickerOpen, setQuietStartPickerOpen] = useState(false);
  const [quietEndPickerOpen, setQuietEndPickerOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);

  const timeFormatOptions: OptionSheetItem<TimeFormat>[] = [
    { key: 'auto', label: t('settings.timeFormatAuto'), desc: t('settings.timeFormatAutoDesc') },
    { key: '12h', label: t('settings.timeFormat12h') },
    { key: '24h', label: t('settings.timeFormat24h') },
  ];

  const fontSizeLabel = t(`settings.fontSize${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}` as any);
  const languageLabel =
    LANGUAGE_OPTIONS.find(o => o.key === language)?.nativeLabel ?? t('settings.systemDefault');
  const masaLabel = t(`panchang.${masaSystem}`);

  const languageOptions: OptionSheetItem<AppLanguage>[] = LANGUAGE_OPTIONS.map(o => ({
    key: o.key,
    label: o.key === 'system' ? t('settings.systemDefault') : o.nativeLabel,
  }));

  const masaOptions: OptionSheetItem<MasaSystem>[] = [
    { key: 'purnimanta', label: t('panchang.purnimanta'), desc: t('settings.masaSystemPurnimantaDesc') },
    { key: 'amanta', label: t('panchang.amanta'), desc: t('settings.masaSystemAmantaDesc') },
  ];

  const ayanamsaOptions: OptionSheetItem<Ayanamsa>[] = [
    { key: 'lahiri', label: t('settings.ayanamsa.lahiri'), desc: t('settings.ayanamsa.lahiriDesc') },
    { key: 'raman', label: t('settings.ayanamsa.raman') },
    { key: 'krishnamurti', label: t('settings.ayanamsa.kp') },
    { key: 'true-chitra', label: t('settings.ayanamsa.trueChitra') },
    { key: 'thirukanitham', label: t('settings.ayanamsa.thirukanitham') },
  ];
  const ayanamsaLabel =
    ayanamsa === 'raman'
      ? t('settings.ayanamsa.raman')
      : ayanamsa === 'krishnamurti'
        ? t('settings.ayanamsa.kp')
        : ayanamsa === 'true-chitra'
          ? t('settings.ayanamsa.trueChitra')
          : ayanamsa === 'thirukanitham'
            ? t('settings.ayanamsa.thirukanitham')
            : t('settings.ayanamsa.lahiri');
  const [ayanamsaSheetOpen, setAyanamsaSheetOpen] = useState(false);

  const chartStyleOptions: OptionSheetItem<ChartStyle>[] = [
    { key: 'north', label: t('settings.chartStyle.north'), desc: t('settings.chartStyle.northDesc') },
    { key: 'south', label: t('settings.chartStyle.south'), desc: t('settings.chartStyle.southDesc') },
  ];
  const chartStyleLabel =
    chartStyle === 'south' ? t('settings.chartStyle.south') : t('settings.chartStyle.north');
  const [chartStyleSheetOpen, setChartStyleSheetOpen] = useState(false);

  const sexOptions: OptionSheetItem<Sex>[] = [
    { key: 'male', label: t('settings.sex.male') },
    { key: 'female', label: t('settings.sex.female') },
  ];
  const sexLabel =
    userSex === 'male'
      ? t('settings.sex.male')
      : userSex === 'female'
        ? t('settings.sex.female')
        : t('settings.sex.notSet');
  const [sexSheetOpen, setSexSheetOpen] = useState(false);

  const houseSystemOptions: OptionSheetItem<HouseSystem>[] = [
    { key: 'whole-sign', label: t('settings.houseSystem.wholeSign'), desc: t('settings.houseSystem.wholeSignDesc') },
    { key: 'equal', label: t('settings.houseSystem.equal') },
    { key: 'placidus-kp', label: t('settings.houseSystem.placidusKp') },
  ];
  const houseSystemLabel =
    houseSystem === 'equal'
      ? t('settings.houseSystem.equal')
      : houseSystem === 'placidus-kp'
        ? t('settings.houseSystem.placidusKp')
        : t('settings.houseSystem.wholeSign');
  const [houseSystemSheetOpen, setHouseSystemSheetOpen] = useState(false);

  const themeOptions: OptionSheetItem<ThemeMode>[] = [
    { key: 'system', label: t('settings.themeSystem'), desc: t('settings.themeSystemDesc') },
    { key: 'light', label: t('settings.themeLight') },
    { key: 'dark', label: t('settings.themeDark') },
  ];
  const themeLabel =
    themeMode === 'light'
      ? t('settings.themeLight')
      : themeMode === 'dark'
        ? t('settings.themeDark')
        : t('settings.themeSystem');

  // Fetch today's sunrise once (needed to schedule the sunrise alert)
  // Also captures the numeric ayanamsa value for the diagnostic row.
  const [ayanamsaValue, setAyanamsaValue] = useState<number | null>(null);
  useEffect(() => {
    fetchPanchangForToday(userLocation, resolveLanguage(language), region, ayanamsa).then((p) => {
      if (p?.sunrise && p.sunrise !== '—') setSunriseTime(p.sunrise);
      if (typeof p?.ayanamsa === 'number') setAyanamsaValue(p.ayanamsa);
    });
  }, [userLocation, language, region, ayanamsa]);

  const locationText = locationName
    ? locationName
    : userLocation
      ? `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`
      : t('settings.usingDefault');

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDailyReminderToggle(val: boolean) {
    if (val) {
      const ok = await scheduleDailyReminder(dailyReminderTime);
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

  async function handleDailyReminderTimeChange(timeHHmm: string) {
    setDailyReminderTime(timeHHmm);
    if (dailyReminderEnabled) {
      await scheduleDailyReminder(timeHHmm);
    }
  }

  async function handleSunriseOffsetChange(min: number) {
    setSunriseAlertOffsetMin(min);
    if (sunriseAlertEnabled && sunriseTime) {
      await scheduleSunriseAlert(sunriseTime, min);
    }
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
      const ok = await scheduleSunriseAlert(sunriseTime, sunriseAlertOffsetMin);
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
    <ScreenMount>
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
        <View style={{ width: 36, height: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Language ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.language')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PickerRow
            icon="globe"
            label={t('settings.appLanguage')}
            value={languageLabel}
            onPress={() => setLangSheetOpen(true)}
            colors={colors}
          />
        </View>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.appearance')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <PickerRow
            icon="moon"
            label={t('settings.theme')}
            value={themeLabel}
            onPress={() => setThemeSheetOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

          <PickerRow
            icon="text"
            label={t('settings.fontSize')}
            value={fontSizeLabel}
            onPress={() => setFontSheetOpen(true)}
            colors={colors}
          />

        </View>

        {/* ── Display ───────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.display')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <PickerRow
            icon="clock"
            label={t('settings.timeFormat')}
            value={
              timeFormat === '12h' ? t('settings.timeFormat12h')
                : timeFormat === '24h' ? t('settings.timeFormat24h')
                  : t('settings.timeFormatAuto')
            }
            onPress={() => setTimeFormatSheetOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

          <SettingRow
            icon="text"
            label={t('settings.devanagariNumerals')}
            sublabel={t('settings.devanagariNumeralsDesc')}
            colors={colors}
            right={
              <Switch
                value={useDevanagariNumerals}
                onValueChange={setUseDevanagariNumerals}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={useDevanagariNumerals ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <SettingRow
            icon="calendar"
            label={t('settings.showVikramSamvat')}
            sublabel={t('settings.showVikramSamvatDesc')}
            colors={colors}
            right={
              <Switch
                value={showVikramSamvat}
                onValueChange={setShowVikramSamvat}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={showVikramSamvat ? colors.accent : colors.textDisabled}
              />
            }
          />

        </View>

        {/* ── Calendar ─────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.calendar')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PickerRow
            icon="calendar"
            label={t('settings.masaSystem')}
            value={masaLabel}
            onPress={() => setMasaSheetOpen(true)}
            colors={colors}
          />
          <Divider colors={colors} />
          <PickerRow
            icon="compass"
            label={t('settings.ayanamsa.label')}
            value={ayanamsaLabel}
            onPress={() => setAyanamsaSheetOpen(true)}
            colors={colors}
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
          <PickerRow
            icon="person"
            label={t('settings.name')}
            value={userName ?? t('settings.nameNotSet')}
            onPress={() => setNameSheetOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

          <PickerRow
            icon="person"
            label={t('settings.sex.label')}
            value={sexLabel}
            onPress={() => setSexSheetOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

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

          <Divider colors={colors} />

          <PickerRow
            icon="clock"
            label={t('settings.birthTime')}
            value={userBirthTime ? formatDisplayTime(userBirthTime) : t('settings.birthTimeNotSet')}
            onPress={() => setBirthTimePickerOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

          <PickerRow
            icon="location"
            label={t('settings.birthPlace')}
            value={userBirthPlace?.name ?? t('settings.birthPlaceNotSet')}
            onPress={() => router.push('/settings/birth-place')}
            colors={colors}
          />

          <Divider colors={colors} />

          <PickerRow
            icon="diamond"
            label={t('settings.chartStyle.label')}
            value={chartStyleLabel}
            onPress={() => setChartStyleSheetOpen(true)}
            colors={colors}
          />

          <Divider colors={colors} />

          <PickerRow
            icon="apps"
            label={t('settings.houseSystem.label')}
            value={houseSystemLabel}
            onPress={() => setHouseSystemSheetOpen(true)}
            colors={colors}
          />
        </View>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <SectionHeader label={t('settings.notifications')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="bell"
            label={t('settings.dailyReminder')}
            sublabel={t('settings.dailyReminderAt', { time: formatDisplayTime(dailyReminderTime) })}
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

          {dailyReminderEnabled && (
            <>
              <Divider colors={colors} />
              <PickerRow
                icon="clock"
                label={t('settings.dailyReminderTime')}
                value={formatDisplayTime(dailyReminderTime)}
                onPress={() => setDailyTimePickerOpen(true)}
                colors={colors}
              />
            </>
          )}

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

          {sunriseAlertEnabled && (
            <>
              <Divider colors={colors} />
              <PickerRow
                icon="alarm"
                label={t('settings.sunriseOffset')}
                value={
                  sunriseAlertOffsetMin === 0
                    ? t('settings.sunriseOffsetAtSunrise')
                    : t('settings.sunriseOffsetMinBefore', { min: sunriseAlertOffsetMin })
                }
                onPress={() => setSunriseOffsetSheetOpen(true)}
                colors={colors}
              />
            </>
          )}

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

          <Divider colors={colors} />

          <SettingRow
            icon="moon"
            label={t('settings.quietHours')}
            sublabel={
              quietHoursEnabled
                ? t('settings.quietHoursActive', {
                    start: formatDisplayTime(quietHoursStart),
                    end: formatDisplayTime(quietHoursEnd),
                  })
                : t('settings.quietHoursDesc')
            }
            colors={colors}
            right={
              <Switch
                value={quietHoursEnabled}
                onValueChange={setQuietHoursEnabled}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={quietHoursEnabled ? colors.accent : colors.textDisabled}
              />
            }
          />

          {quietHoursEnabled && (
            <>
              <Divider colors={colors} />
              <PickerRow
                icon="clock"
                label={t('settings.quietHoursStart')}
                value={formatDisplayTime(quietHoursStart)}
                onPress={() => setQuietStartPickerOpen(true)}
                colors={colors}
              />
              <Divider colors={colors} />
              <PickerRow
                icon="clock"
                label={t('settings.quietHoursEnd')}
                value={formatDisplayTime(quietHoursEnd)}
                onPress={() => setQuietEndPickerOpen(true)}
                colors={colors}
              />
            </>
          )}

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

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.rateApp')}
            onPress={() => { void requestRating(); }}>
            <SettingRow
              icon="heart"
              label={t('settings.rateApp')}
              sublabel={t('settings.rateAppDesc')}
              colors={colors}
              right={<Icon name="arrow-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

          <Divider colors={colors} />

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.shareApp')}
            onPress={() => { void shareApp(t('settings.shareAppMessage')); }}>
            <SettingRow
              icon="share"
              label={t('settings.shareApp')}
              sublabel={t('settings.shareAppDesc')}
              colors={colors}
              right={<Icon name="arrow-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

          <Divider colors={colors} />

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.sendFeedback')}
            onPress={() => Linking.openURL('mailto:ishank1995dev@gmail.com?subject=Dharmagya%20Feedback')}>
            <SettingRow
              icon="chat"
              label={t('settings.sendFeedback')}
              sublabel={t('settings.sendFeedbackDesc')}
              colors={colors}
              right={<Icon name="arrow-right" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

          <Divider colors={colors} />

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.privacyPolicy')}
            onPress={() => Linking.openURL('https://dharmagya.app/privacy')}>
            <SettingRow
              icon="shield"
              label={t('settings.privacyPolicy')}
              sublabel={t('settings.privacyPolicyDesc')}
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
            right={<Text variant="mono" style={[styles.versionText, { color: colors.textMuted }]}>v{Constants.expoConfig?.version ?? '—'}</Text>}
          />

          {ayanamsaValue !== null && (
            <>
              <Divider colors={colors} />
              <SettingRow
                icon="compass"
                label={t('settings.ayanamsa.label')}
                sublabel={ayanamsaLabel}
                colors={colors}
                right={
                  <Text variant="mono" style={[styles.versionText, { color: colors.textMuted }]}>
                    {t('settings.ayanamsa.value', { degrees: ayanamsaValue.toFixed(2) })}
                  </Text>
                }
              />
            </>
          )}

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

      <FontSizeSheet
        visible={fontSheetOpen}
        onClose={() => setFontSheetOpen(false)}
        value={fontSize}
        onChange={setFontSize}
        colors={colors}
      />

      <OptionSheet
        visible={langSheetOpen}
        onClose={() => setLangSheetOpen(false)}
        title={t('settings.languagePickerTitle')}
        options={languageOptions}
        value={language}
        onChange={(next) => handleLanguageChange(next as AppLanguage)}
        colors={colors}
      />

      <OptionSheet
        visible={masaSheetOpen}
        onClose={() => setMasaSheetOpen(false)}
        title={t('settings.masaSystemPickerTitle')}
        options={masaOptions}
        value={masaSystem}
        onChange={(next) => setMasaSystem(next as MasaSystem)}
        colors={colors}
      />

      <OptionSheet
        visible={ayanamsaSheetOpen}
        onClose={() => setAyanamsaSheetOpen(false)}
        title={t('settings.ayanamsa.pickerTitle')}
        options={ayanamsaOptions}
        value={ayanamsa}
        onChange={(next) => setAyanamsa(next as Ayanamsa)}
        colors={colors}
      />

      <OptionSheet
        visible={chartStyleSheetOpen}
        onClose={() => setChartStyleSheetOpen(false)}
        title={t('settings.chartStyle.pickerTitle')}
        options={chartStyleOptions}
        value={chartStyle}
        onChange={(next) => setChartStyle(next as ChartStyle)}
        colors={colors}
      />

      <OptionSheet
        visible={houseSystemSheetOpen}
        onClose={() => setHouseSystemSheetOpen(false)}
        title={t('settings.houseSystem.pickerTitle')}
        options={houseSystemOptions}
        value={houseSystem}
        onChange={(next) => setHouseSystem(next as HouseSystem)}
        colors={colors}
      />

      <OptionSheet
        visible={sexSheetOpen}
        onClose={() => setSexSheetOpen(false)}
        title={t('settings.sex.pickerTitle')}
        options={sexOptions}
        value={userSex ?? 'male'}
        onChange={(next) => setUserSex(next as Sex)}
        colors={colors}
      />

      <OptionSheet
        visible={themeSheetOpen}
        onClose={() => setThemeSheetOpen(false)}
        title={t('settings.themePickerTitle')}
        options={themeOptions}
        value={themeMode}
        onChange={(next) => setThemeMode(next as ThemeMode)}
        colors={colors}
      />

      <TimePickerModal
        visible={dailyTimePickerOpen}
        onClose={() => setDailyTimePickerOpen(false)}
        value={dailyReminderTime}
        onPick={handleDailyReminderTimeChange}
        title={t('settings.dailyReminderTimePickerTitle')}
      />

      <OptionSheet
        visible={sunriseOffsetSheetOpen}
        onClose={() => setSunriseOffsetSheetOpen(false)}
        title={t('settings.sunriseOffsetPickerTitle')}
        options={SUNRISE_OFFSET_OPTIONS.map(o => ({
          key: o.key,
          label: o.min === 0
            ? t('settings.sunriseOffsetAtSunrise')
            : t('settings.sunriseOffsetMinBefore', { min: o.min }),
        }))}
        value={String(sunriseAlertOffsetMin)}
        onChange={(next) => handleSunriseOffsetChange(parseInt(next, 10))}
        colors={colors}
      />

      <TimePickerModal
        visible={birthTimePickerOpen}
        onClose={() => setBirthTimePickerOpen(false)}
        value={userBirthTime ?? '12:00'}
        onPick={setUserBirthTime}
        title={t('settings.birthTimePickerTitle')}
      />

      <OptionSheet
        visible={timeFormatSheetOpen}
        onClose={() => setTimeFormatSheetOpen(false)}
        title={t('settings.timeFormatPickerTitle')}
        options={timeFormatOptions}
        value={timeFormat}
        onChange={(next) => setTimeFormat(next as TimeFormat)}
        colors={colors}
      />

      <TimePickerModal
        visible={quietStartPickerOpen}
        onClose={() => setQuietStartPickerOpen(false)}
        value={quietHoursStart}
        onPick={setQuietHoursStart}
        title={t('settings.quietHoursStartPickerTitle')}
      />

      <TimePickerModal
        visible={quietEndPickerOpen}
        onClose={() => setQuietEndPickerOpen(false)}
        value={quietHoursEnd}
        onPick={setQuietHoursEnd}
        title={t('settings.quietHoursEndPickerTitle')}
      />

      <NameSheet
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        value={userName ?? ''}
        onSave={(next) => {
          setUserName(next);
          setNameSheetOpen(false);
        }}
        colors={colors}
      />

    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Name Sheet (free-text input) ───────────────────────────────────────────

interface NameSheetProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSave: (next: string) => void;
  colors: ColorPalette;
}

function NameSheet({ visible, onClose, value, onSave, colors }: NameSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  // Re-sync the draft each time the sheet opens, so re-opens show the latest
  // saved value rather than a stale one. Local edits stay local until Save.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text variant="display-italic" style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {t('settings.namePickerTitle')}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('settings.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            maxLength={40}
            onSubmitEditing={() => onSave(draft)}
            style={[styles.nameInput, { color: colors.textPrimary, backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}
            accessibilityLabel={t('settings.name')}
          />
          <TouchableOpacity
            onPress={() => onSave(draft)}
            style={[styles.pickerDoneBtn, { backgroundColor: palette.sindoor, marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}>
            <Text variant="mono-caps" style={[styles.pickerDoneText, { color: palette.parchmentBright }]}>
              {t('common.save')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={styles.nameCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <Text variant="mono-caps" style={[styles.nameCancelText, { color: colors.textMuted }]}>
              {t('common.close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Generic Option Sheet ───────────────────────────────────────────────────

interface OptionSheetItem<T extends string> {
  key: T;
  label: string;
  desc?: string;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: OptionSheetItem<T>[];
  value: T;
  onChange: (next: T) => void;
  colors: ColorPalette;
}

function OptionSheet<T extends string>({
  visible, onClose, title, options, value, onChange, colors,
}: OptionSheetProps<T>) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text variant="display-italic" style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <View style={{ marginTop: 4 }}>
            {options.map((opt, i) => {
              const active = opt.key === value;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.7}
                  onPress={() => onChange(opt.key)}
                  style={[
                    styles.sheetItem,
                    i < options.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                    active && { backgroundColor: colors.accent + '18' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: active }}>
                  <View style={styles.sheetItemText}>
                    <Text variant="body" style={[styles.sheetItemLabel, { color: active ? colors.accent : colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                    {opt.desc && (
                      <Text variant="body-italic" style={[styles.sheetItemDesc, { color: colors.textTertiary }]}>
                        {opt.desc}
                      </Text>
                    )}
                  </View>
                  {active && <Icon name="check" size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.pickerDoneBtn, { backgroundColor: palette.sindoor, marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}>
            <Text variant="mono-caps" style={[styles.pickerDoneText, { color: palette.parchmentBright }]}>
              {t('common.done')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Picker Row (current-value + chevron, opens a sheet) ────────────────────

interface PickerRowProps {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  colors: ColorPalette;
  a11yLabel?: string;
}

function PickerRow({ icon, label, value, onPress, colors, a11yLabel }: PickerRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}>
      <SettingRow
        icon={icon}
        label={label}
        colors={colors}
        right={
          <View style={styles.regionRight}>
            <Text
              variant="body-italic"
              style={[styles.regionValue, { color: colors.textPrimary }]}
              numberOfLines={1}>
              {value}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textMuted} />
          </View>
        }
      />
    </TouchableOpacity>
  );
}

// ─── Font Size Sheet (preview + segmented steps) ────────────────────────────

interface FontSizeSheetProps {
  visible: boolean;
  onClose: () => void;
  value: FontSize;
  onChange: (size: FontSize) => void;
  colors: ColorPalette;
}

const FONT_SIZE_STEPS: { key: FontSize; tKey: string; sample: number }[] = [
  { key: 'small',  tKey: 'settings.fontSizeSmall',  sample: 11 },
  { key: 'normal', tKey: 'settings.fontSizeNormal', sample: 13 },
  { key: 'medium', tKey: 'settings.fontSizeMedium', sample: 15 },
  { key: 'large',  tKey: 'settings.fontSizeLarge',  sample: 17 },
];

function FontSizeSheet({ visible, onClose, value, onChange, colors }: FontSizeSheetProps) {
  const { t } = useTranslation();
  const activeStep = FONT_SIZE_STEPS.find(s => s.key === value);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text variant="display-italic" style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {t('settings.fontSizePickerTitle')}
          </Text>

          {/* Live preview — uses AppText so it scales with the store */}
          <View style={[styles.previewWrap, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <Text variant="body" style={[styles.previewBody, { color: colors.textPrimary }]}>
              {t('settings.fontSizePreview')}
            </Text>
          </View>

          {/* Segmented Aa steps */}
          <View style={[styles.segmentRow, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            {FONT_SIZE_STEPS.map((step, i) => {
              const active = step.key === value;
              return (
                <TouchableOpacity
                  key={step.key}
                  onPress={() => onChange(step.key)}
                  style={[
                    styles.segmentBtn,
                    i < FONT_SIZE_STEPS.length - 1 && {
                      borderRightWidth: StyleSheet.hairlineWidth,
                      borderRightColor: colors.border,
                    },
                    active && { backgroundColor: colors.accent },
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                  accessibilityRole="button"
                  accessibilityLabel={t(step.tKey)}
                  accessibilityState={{ selected: active }}>
                  <RNText style={[styles.segmentGlyph, {
                    fontSize: step.sample,
                    color: active ? '#FFFFFF' : colors.textSecondary,
                  }]}>
                    A
                  </RNText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Current step name */}
          <Text variant="mono-caps" style={[styles.segmentCaption, { color: colors.textMuted }]}>
            {activeStep ? t(activeStep.tKey) : ''}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.pickerDoneBtn, { backgroundColor: palette.sindoor, marginTop: 18 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}>
            <Text variant="mono-caps" style={[styles.pickerDoneText, { color: palette.parchmentBright }]}>
              {t('common.done')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  // Two opposing layouts share this component, so shrink direction is
  // conditional on whether a sublabel is present:
  //   - With sublabel (toggle / nav rows): the long content is in the LEFT
  //     column (sublabel) and the right is a fixed widget (Switch / chevron).
  //     rowText must shrink so the sublabel truncates; rowRight must NOT
  //     shrink or the Switch gets clipped.
  //   - Without sublabel (PickerRow style): the long content is in the RIGHT
  //     column (value text) and rowText only holds the label. rowRight must
  //     shrink so the value truncates; rowText must NOT shrink or the label
  //     wraps character-per-line.
  const hasSublabel = !!sublabel;
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <View style={[styles.rowText, hasSublabel && styles.rowTextShrinkable]}>
        <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && (
          <Text variant="body-italic" style={[styles.rowSublabel, { color: colors.textTertiary }]} numberOfLines={1}>
            {sublabel}
          </Text>
        )}
      </View>
      {right && (
        <View style={[styles.rowRight, hasSublabel && styles.rowRightFixed]}>
          {right}
        </View>
      )}
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
  // flexGrow:1 (NOT flex:1) so flexBasis stays 'auto'. SettingRow toggles
  // rowTextShrinkable / rowRightFixed below depending on which column is
  // expected to carry the long content — see the comment in SettingRow.
  rowText: { flexGrow: 1, minWidth: 0 },
  rowTextShrinkable: { flexShrink: 1 },
  rowLabel: { fontSize: 15, lineHeight: 20 },
  rowSublabel: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', flexShrink: 1, minWidth: 0 },
  rowRightFixed: { flexShrink: 0 },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  // Status dot
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  locationRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Region picker
  regionRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  regionValue: { fontSize: 13, flexShrink: 1 },
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

  // Generic picker sheet (reused by language + masa system)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 20, marginBottom: 14, textAlign: 'center' },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 12,
  },
  sheetItemText: { flex: 1 },
  sheetItemLabel: { fontSize: 15 },
  sheetItemDesc: { fontSize: 12, marginTop: 2 },

  // Name sheet
  nameInput: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: 'Fraunces_400Regular',
  },
  nameCancel: { alignItems: 'center', marginTop: 10, paddingVertical: 6 },
  nameCancelText: { fontSize: 10 },

  // Font size sheet
  previewWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
    minHeight: 88,
    justifyContent: 'center',
  },
  previewBody: { fontSize: 15, lineHeight: 22 },

  segmentRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentGlyph: {
    fontFamily: 'Fraunces_500Medium',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  segmentCaption: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 1,
  },
});
