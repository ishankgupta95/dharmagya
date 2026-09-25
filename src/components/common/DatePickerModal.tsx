import { useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { AppText as Text } from './AppText';
import { borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useStore } from '@/store/useStore';

/**
 * Date picker — wraps the native OS date picker (`@react-native-community/
 * datetimepicker`). Android delegates to the system date dialog (with a neutral
 * "Clear" button when `onClear` is set); iOS shows an inline spinner inside the
 * parchment sheet. Replaces the old hand-rolled month-grid + year-jumper, whose
 * year wheel could stick.
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
  /** Lower-bound date (inclusive). */
  minDate?: Date;
  /** Upper-bound date (inclusive). */
  maxDate?: Date;
  colors: ColorPalette;
  /** Header title to display. */
  title?: string;
  /**
   * `'day'` (default) — pick a full date.
   * `'month'` — the caller only needs year + month; the day-of-month is
   * preserved from `value` (clamped to the picked month's length).
   */
  mode?: 'day' | 'month';
}

function minBound(p: DatePickerModalProps): Date {
  return p.minDate ?? new Date(p.minYear ?? 1900, 0, 1);
}
function maxBound(p: DatePickerModalProps): Date {
  return p.maxDate ?? new Date(p.maxYear ?? new Date().getFullYear(), 11, 31, 23, 59, 59);
}

// In 'month' mode the caller only wants year+month, so keep `value`'s day-of-month
// (clamped to the picked month's length) — matches the old month-jumper.
function applyMode(picked: Date, mode: 'day' | 'month', valueMs: number | null): Date {
  if (mode !== 'month' || valueMs === null) return picked;
  const daysInMonth = new Date(picked.getFullYear(), picked.getMonth() + 1, 0).getDate();
  const valueDay = new Date(valueMs).getDate();
  return new Date(picked.getFullYear(), picked.getMonth(), Math.min(valueDay, daysInMonth));
}

// Both platform pickers read the bound date as `valueMs` — its timestamp, a
// primitive — never as the `value` Date object. Each has "re-seed the wheel
// when the value changes" logic, and keying it on the object's identity meant
// a parent that rebuilds an equal Date on every render (e.g.
// `new Date(iso + 'T12:00:00')` inline) snapped the wheel back under the
// user's thumb mid-scroll. A real change of date (a different instant) still
// re-seeds. The timestamp is taken here, in the wrapper, so it reaches the
// platform components as a primitive prop: computed inside them, the React
// Compiler folds the `.getTime()` call into the memo scope it feeds, and
// that scope then invalidates on `value`'s identity again.
type PlatformPickerProps = DatePickerModalProps & { valueMs: number | null };

export function DatePickerModal(props: DatePickerModalProps) {
  const valueMs = props.value ? props.value.getTime() : null;
  if (Platform.OS === 'android') {
    return <AndroidDatePicker {...props} valueMs={valueMs} />;
  }
  return <IosDatePicker {...props} valueMs={valueMs} />;
}

function AndroidDatePicker(props: PlatformPickerProps) {
  const { visible, onClose, onPick, onClear, valueMs, mode = 'day' } = props;
  const { t } = useTranslation();
  if (!visible) return null;

  // The library re-seeds the open dialog's wheel (`updateDate`) whenever the
  // `value` timestamp OR the `onChange` identity changes, so `handleChange`
  // closes over `valueMs` only and its memo is keyed on that primitive.
  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'neutralButtonPressed') {
      onClear?.();
    } else if (event.type === 'set' && selected) {
      onPick(applyMode(selected, mode, valueMs));
    }
    onClose();
  }

  return (
    <DateTimePicker
      value={valueMs === null ? new Date() : new Date(valueMs)}
      mode="date"
      display="spinner"
      onChange={handleChange}
      minimumDate={minBound(props)}
      maximumDate={maxBound(props)}
      neutralButton={onClear ? { label: t('common.clear') } : undefined}
    />
  );
}

function IosDatePicker(props: PlatformPickerProps) {
  const { visible, onClose, onPick, onClear, valueMs, title, colors, mode = 'day' } = props;
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const [draft, setDraft] = useState<Date>(() => (valueMs === null ? new Date() : new Date(valueMs)));
  // Re-seed the wheel when the sheet opens, or when the bound date changes
  // while it is open — React's "adjust state when a prop changes" pattern,
  // done during render (React re-renders right away, no effect round-trip) by
  // comparing against the last-seen `{ visible, valueMs }`. Keyed on the
  // timestamp (see `PlatformPickerProps`), so a new Date object holding the
  // same instant is not a change. `Object.is` so an Invalid Date's NaN
  // compares equal to itself instead of re-rendering forever.
  const [seen, setSeen] = useState({ visible, valueMs });
  if (seen.visible !== visible || !Object.is(seen.valueMs, valueMs)) {
    setSeen({ visible, valueMs });
    if (visible) setDraft(valueMs === null ? new Date() : new Date(valueMs));
  }

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }
  function handleDone() {
    onPick(applyMode(draft, mode, valueMs));
    onClose();
  }
  function handleClear() {
    onClear?.();
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
            {title ?? t('common.pickDate')}
          </Text>

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              onChange={handleChange}
              minimumDate={minBound(props)}
              maximumDate={maxBound(props)}
              accentColor={palette.turmeric}
              textColor={colors.textPrimary}
              themeVariant={isDark ? 'dark' : 'light'}
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

          {onClear && (
            <MotionPressable
              pressedScale={0.97}
              onPress={handleClear}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}>
              <Text variant="title" style={[styles.clearText, { color: colors.textTertiary }]}>
                {t('common.clear')}
              </Text>
            </MotionPressable>
          )}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Bottom padding for the iOS sheet: 28pt of breathing room, or the window's
// bottom safe-area inset + 12 when that is larger, so Done / Clear clear the
// 34pt home indicator (audit L-02). Read from the window metrics rather than
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
  clearBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearText: { fontSize: 13 },
});
