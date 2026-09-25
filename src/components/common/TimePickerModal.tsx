import { useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { AppText as Text } from './AppText';
import { borderRadius, darkColors, lightColors, palette, spacing } from '@/config/theme';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useStore } from '@/store/useStore';

/**
 * Editorial time picker. iOS shows an inline `@react-native-community/datetimepicker`
 * spinner inside our parchment sheet; Android delegates to the native time dialog.
 *
 * Accepts and emits `HH:mm` 24-hour strings so callers can persist them as
 * compact primitives.
 */
export interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onPick: (timeHHmm: string) => void;
  title?: string;
  /** Show the system 24h vs 12h indicator. Defaults to platform locale. */
  is24Hour?: boolean;
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToHHmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TimePickerModal(props: TimePickerModalProps) {
  if (Platform.OS === 'android') {
    return <AndroidTimePicker {...props} />;
  }
  return <IosTimePicker {...props} />;
}

function IosTimePicker({ visible, onClose, value, onPick, title, is24Hour }: TimePickerModalProps) {
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const colors = isDark ? darkColors : lightColors;
  const [draft, setDraft] = useState<Date>(() => hhmmToDate(value));
  // Re-seed the wheel when the sheet opens, or when the bound `value` changes
  // while it is open — React's "adjust state when a prop changes" pattern,
  // done during render (React re-renders right away, no effect round-trip) by
  // comparing against the last-seen `{ visible, value }`. The trigger set is
  // deliberately the old effect's `[visible, value]`; `value` is an `HH:mm`
  // string here, so a mid-open reset only happens on a real time change.
  const [seen, setSeen] = useState({ visible, value });
  if (seen.visible !== visible || seen.value !== value) {
    setSeen({ visible, value });
    if (visible) setDraft(hhmmToDate(value));
  }

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }

  function handleDone() {
    onPick(dateToHHmm(draft));
    onClose();
  }

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
          style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          accessible={false}>

          <Text variant="title" style={[styles.title, { color: colors.textPrimary }]}>
            {title ?? t('common.pickTime')}
          </Text>

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              onChange={handleChange}
              accentColor={palette.turmeric}
              textColor={colors.textPrimary}
              themeVariant={isDark ? 'dark' : 'light'}
              is24Hour={is24Hour}
              style={styles.picker}
            />
          </View>

          <MotionPressable
            pressedScale={0.97}
            onPress={handleDone}
            style={[styles.doneBtn, { backgroundColor: palette.turmeric }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}>
            <Text variant="button" style={styles.doneText}>
              {t('common.done')}
            </Text>
          </MotionPressable>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function AndroidTimePicker({ visible, onClose, value, onPick, is24Hour }: TimePickerModalProps) {
  if (!visible) return null;

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      onPick(dateToHHmm(selected));
    }
    onClose();
  }

  return (
    <DateTimePicker
      value={hhmmToDate(value)}
      mode="time"
      display="spinner"
      onChange={handleChange}
      is24Hour={is24Hour}
    />
  );
}

// Bottom padding for the iOS sheet: 28pt of breathing room, or the window's
// bottom safe-area inset + 12 when that is larger, so Done clears the 34pt
// home indicator (audit L-02). Read from the window metrics rather than
// `useSafeAreaInsets()`: this sheet also opens from inside NativeTabs, whose
// per-tab SafeAreaProvider reports the tab bar's height as the bottom inset,
// but a Modal is presented over the bar, so the window inset is the right one.
// A launch-time constant is safe — the app is portrait-only on iPhone and
// iPad's bottom inset does not change with orientation. Android never renders
// this sheet (it gets the system dialog), so the edge-to-edge nav-bar inset
// cannot double-pad it.
const SHEET_PADDING_BOTTOM = Math.max(28, (initialWindowMetrics?.insets.bottom ?? 0) + 12);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,10,4,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 24,
    paddingBottom: SHEET_PADDING_BOTTOM,
    paddingHorizontal: spacing.screenH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 14,
  },
  title: { fontSize: 18, lineHeight: 25, textAlign: 'center', marginBottom: 8 },
  pickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 215,
    marginBottom: 4,
  },
  picker: { width: '100%' },
  doneBtn: {
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  doneText: { fontSize: 15, color: palette.night },
});
