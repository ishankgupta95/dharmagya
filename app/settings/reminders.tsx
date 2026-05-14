import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import {
  useStore,
  type TithiReminderKey,
  type FestivalReminderKey,
} from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ScreenMount } from '@/components/common/ScreenMount';
import { rescheduleReminders, cancelAllReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';
import { rescheduleSadhanaReminder } from '@/services/sadhanaReminders';
import { TimePickerModal } from '@/components/common/TimePickerModal';
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

  // Sadhana practice reminder (P14.4) — opt-in evening nudge if the user
  // hasn't begun their sadhana yet today.
  const sadhana = useStore(s => s.sadhana);
  const sadhanaReminderEnabled = useStore(s => s.sadhanaReminderEnabled);
  const setSadhanaReminderEnabled = useStore(s => s.setSadhanaReminderEnabled);
  const sadhanaReminderTime = useStore(s => s.sadhanaReminderTime);
  const setSadhanaReminderTime = useStore(s => s.setSadhanaReminderTime);
  const quietHoursEnabled = useStore(s => s.quietHoursEnabled);
  const quietHoursStart = useStore(s => s.quietHoursStart);
  const quietHoursEnd = useStore(s => s.quietHoursEnd);

  const [tithiTimePickerOpen, setTithiTimePickerOpen] = useState(false);
  const [festivalTimePickerOpen, setFestivalTimePickerOpen] = useState(false);
  const [sadhanaTimePickerOpen, setSadhanaTimePickerOpen] = useState(false);

  // Re-schedule the sadhana horizon when the toggle / time changes. Same
  // debounce semantics as the tithi/festival reminders above, but a separate
  // effect so the two namespaces don't interfere.
  const sadhanaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sadhanaDebounceRef.current) clearTimeout(sadhanaDebounceRef.current);
    sadhanaDebounceRef.current = setTimeout(() => {
      void rescheduleSadhanaReminder({
        enabled: sadhanaReminderEnabled,
        timeHHmm: sadhanaReminderTime,
        sadhana,
        quietHours: quietHoursEnabled
          ? { enabled: true, startHHmm: quietHoursStart, endHHmm: quietHoursEnd }
          : undefined,
      });
    }, 300);
    return () => {
      if (sadhanaDebounceRef.current) clearTimeout(sadhanaDebounceRef.current);
    };
  }, [sadhanaReminderEnabled, sadhanaReminderTime, sadhana, quietHoursEnabled, quietHoursStart, quietHoursEnd]);

  async function handleSadhanaToggle(val: boolean) {
    if (val && !sadhanaReminderEnabled) {
      const ok = await ensurePermission(t);
      if (!ok) return;
    }
    setSadhanaReminderEnabled(val);
  }

  // Debounce: reschedule after the user stops tapping toggles or changing
  // times for 300ms.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (hasAnyReminderEnabled(prefs)) {
        void rescheduleReminders(prefs, { tithi: tithiReminderTime, festival: festivalReminderTime });
      } else {
        void cancelAllReminders();
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prefs, tithiReminderTime, festivalReminderTime]);

  async function handleTithiToggle(key: TithiReminderKey, val: boolean) {
    if (val && !hasAnyReminderEnabled(prefs)) {
      const ok = await ensurePermission(t);
      if (!ok) return;
    }
    setTithi(key, val);
  }

  async function handleFestivalToggle(key: FestivalReminderKey, val: boolean) {
    if (val && !hasAnyReminderEnabled(prefs)) {
      const ok = await ensurePermission(t);
      if (!ok) return;
    }
    setFestival(key, val);
  }

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('reminders.title')}
        </Text>
        <View style={[styles.backPill, { borderWidth: 0 }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.intro, { color: colors.textTertiary }]}>
          {t('reminders.intro')}
        </Text>

        {/* ── Sadhana practice (P14.4) ────────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>{t('reminders.sadhanaSection')}</SectionLabel>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ToggleRow
            icon="flame"
            label={t('reminders.sadhanaLabel')}
            sublabel={t('reminders.sadhanaSublabel')}
            value={sadhanaReminderEnabled}
            onChange={handleSadhanaToggle}
            colors={colors}
            showDivider={sadhanaReminderEnabled}
          />
          {sadhanaReminderEnabled && (
            <TimeRow
              icon="clock"
              label={t('reminders.sadhanaTimeLabel')}
              value={formatDisplayTime(sadhanaReminderTime)}
              onPress={() => setSadhanaTimePickerOpen(true)}
              colors={colors}
            />
          )}
        </View>

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

      <TimePickerModal
        visible={sadhanaTimePickerOpen}
        onClose={() => setSadhanaTimePickerOpen(false)}
        value={sadhanaReminderTime}
        onPick={setSadhanaReminderTime}
        title={t('reminders.sadhanaTimePickerTitle')}
      />
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
    <TouchableOpacity
      activeOpacity={0.7}
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
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensurePermission(t: (k: string) => string): Promise<boolean> {
  const { requestNotificationPermission } = await import('@/services/notifications');
  const granted = await requestNotificationPermission();
  if (!granted) {
    Alert.alert(t('settings.permissionRequired'), t('settings.permissionRequiredDesc'));
  }
  return granted;
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
