import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Switch, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { MotionPressable } from '@/components/common/MotionPressable';
import {
  useStore,
  type TithiReminderKey,
  type FestivalReminderKey,
} from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ScreenMount } from '@/components/common/ScreenMount';
import { rescheduleReminders, cancelAllReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { useNotificationPermissionGate } from '@/components/common/NotificationPermissionPrompt';
import { useLocaleFormatters } from '@/utils/format';

const TITHI_KEYS: TithiReminderKey[] = ['ekadashi', 'pradosha', 'purnima', 'amavasya', 'sankashti', 'shivaratri'];
const FESTIVAL_KEYS: FestivalReminderKey[] = ['major', 'minor', 'ekadashi', 'pradosha', 'sankranti'];

const TITHI_ICONS: Record<TithiReminderKey, IconName> = {
  ekadashi: 'moon',
  pradosha: 'moon',
  purnima: 'circle-outline',
  amavasya: 'ellipse',
  sankashti: 'ribbon',
  shivaratri: 'flame',
};

const FESTIVAL_ICONS: Record<FestivalReminderKey, IconName> = {
  major: 'star',
  minor: 'star-half',
  ekadashi: 'moon',
  pradosha: 'moon',
  sankranti: 'sun',
};

export default function RemindersScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const prefs = useStore(s => s.reminderPrefs);
  const setTithi = useStore(s => s.setTithiReminder);
  const setFestival = useStore(s => s.setFestivalReminder);
  const tithiReminderTime = useStore(s => s.tithiReminderTime);
  const festivalReminderTime = useStore(s => s.festivalReminderTime);
  const setTithiReminderTime = useStore(s => s.setTithiReminderTime);
  const setFestivalReminderTime = useStore(s => s.setFestivalReminderTime);
  const { formatTime: formatDisplayTime } = useLocaleFormatters();

  // Quiet hours are edited in Settings, but this screen re-schedules the whole
  // reminder horizon on mount and after every toggle — so it has to apply the
  // same shift the root layout does, or a visit here silently rewrites the
  // schedule with the quiet window dropped.
  const quietHoursEnabled = useStore(s => s.quietHoursEnabled);
  const quietHoursStart = useStore(s => s.quietHoursStart);
  const quietHoursEnd = useStore(s => s.quietHoursEnd);
  const quietHours = useMemo(
    () => ({ enabled: quietHoursEnabled, startHHmm: quietHoursStart, endHHmm: quietHoursEnd }),
    [quietHoursEnabled, quietHoursStart, quietHoursEnd],
  );

  const [tithiTimePickerOpen, setTithiTimePickerOpen] = useState(false);
  const [festivalTimePickerOpen, setFestivalTimePickerOpen] = useState(false);

  // Permission: every OFF → ON flip goes through the gate unless the last
  // known state is already "granted" — not just the first reminder. It used to
  // be checked only while no reminder was on, so once notifications had been
  // switched off in the system Settings, turning on a second reminder
  // "worked" here while nothing could ever fire. The gate shows the editorial
  // pre-prompt and the OS dialog while the OS can still ask, and an "Open
  // Settings" alert once it can't (iOS never asks twice). The toggle only
  // commits on a grant, so a refusal leaves the switch off.
  const {
    granted: notificationsGranted,
    ensurePermission,
    prompt: permissionPrompt,
  } = useNotificationPermissionGate();

  // Navratri context — `prefs.festival.major` triggers the 9-day Navratri
  // sequence, which needs panchang-compute inputs.
  const userLocation = useStore(s => s.userLocation);
  const ayanamsa = useStore(s => s.ayanamsa);
  const masaSystem = useStore(s => s.masaSystem);

  // Debounce: reschedule after the user stops tapping toggles or changing
  // times for 300ms.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (hasAnyReminderEnabled(prefs)) {
        void rescheduleReminders(
          prefs,
          { tithi: tithiReminderTime, festival: festivalReminderTime },
          quietHours,
          { coords: userLocation, ayanamsa, masaSystem },
        );
      } else {
        void cancelAllReminders();
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prefs, tithiReminderTime, festivalReminderTime, quietHours, userLocation, ayanamsa, masaSystem]);

  async function handleTithiToggle(key: TithiReminderKey, val: boolean) {
    if (val && !notificationsGranted && !(await ensurePermission('tithi'))) return;
    setTithi(key, val);
  }

  async function handleFestivalToggle(key: FestivalReminderKey, val: boolean) {
    if (val && !notificationsGranted && !(await ensurePermission('festival'))) return;
    setFestival(key, val);
  }

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </MotionPressable>
        <Text variant="display" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('reminders.title')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.intro, { color: colors.textTertiary }]}>
          {t('reminders.intro')}
        </Text>

        {/* ── Tithi Reminders ─────────────────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>{t('reminders.tithiSection')}</SectionLabel>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {TITHI_KEYS.map((key, i) => (
            <ToggleRow
              key={key}
              icon={TITHI_ICONS[key]}
              label={t(`reminders.tithiLabel.${key}`)}
              sublabel={t(`reminders.tithiSublabel.${key}`)}
              value={prefs.tithi[key]}
              onChange={(v) => handleTithiToggle(key, v)}
              colors={colors}
              showDivider
            />
          ))}
          <TimeRow
            icon="clock"
            label={t('reminders.tithiTimeLabel')}
            value={formatDisplayTime(tithiReminderTime)}
            onPress={() => setTithiTimePickerOpen(true)}
            colors={colors}
          />
        </View>

        {/* ── Festival Category Reminders ─────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>{t('reminders.festivalSection')}</SectionLabel>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {FESTIVAL_KEYS.map((key, i) => (
            <ToggleRow
              key={key}
              icon={FESTIVAL_ICONS[key]}
              label={t(`reminders.festivalLabel.${key}`)}
              sublabel={t(`reminders.festivalSublabel.${key}`)}
              value={prefs.festival[key]}
              onChange={(v) => handleFestivalToggle(key, v)}
              colors={colors}
              showDivider
            />
          ))}
          <TimeRow
            icon="clock"
            label={t('reminders.festivalTimeLabel')}
            value={formatDisplayTime(festivalReminderTime)}
            onPress={() => setFestivalTimePickerOpen(true)}
            colors={colors}
          />
        </View>

        <Text variant="body-italic" style={[styles.footer, { color: colors.textMuted }]}>
          {t('reminders.footer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      <TimePickerModal
        visible={tithiTimePickerOpen}
        onClose={() => setTithiTimePickerOpen(false)}
        value={tithiReminderTime}
        onPick={setTithiReminderTime}
        title={t('reminders.tithiTimePickerTitle')}
      />

      <TimePickerModal
        visible={festivalTimePickerOpen}
        onClose={() => setFestivalTimePickerOpen(false)}
        value={festivalReminderTime}
        onPick={setFestivalReminderTime}
        title={t('reminders.festivalTimePickerTitle')}
      />

      {permissionPrompt}
    </SafeAreaView>
    </ScreenMount>
  );
}

interface TimeRowProps {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  colors: ColorPalette;
}

function TimeRow({ icon, label, value, onPress, colors }: TimeRowProps) {
  return (
    <MotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
          <Icon name={icon} size={16} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        </View>
        <Text variant="body-italic" style={{ color: colors.textPrimary, fontSize: 13, marginRight: 6 }}>
          {value}
        </Text>
        <Icon name="chevron-right" size={14} color={colors.textMuted} />
      </View>
    </MotionPressable>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: IconName;
  label: string;
  sublabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ColorPalette;
  showDivider: boolean;
}

function ToggleRow({ icon, label, sublabel, value, onChange, colors, showDivider }: ToggleRowProps) {
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
          <Icon name={icon} size={16} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
          <Text variant="body-italic" style={[styles.rowSublabel, { color: colors.textTertiary }]} numberOfLines={2}>
            {sublabel}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.accent + '60' }}
          thumbColor={value ? colors.accent : colors.textDisabled}
        />
      </View>
      {showDivider && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 30, lineHeight: 40 },

  scroll: { paddingTop: 14, paddingBottom: 32 },

  intro: { fontSize: 14, lineHeight: 20, marginBottom: 8 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 10, marginLeft: 4 },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

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

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  footer: { fontSize: 12, lineHeight: 17, marginTop: 20, textAlign: 'center' },
});
