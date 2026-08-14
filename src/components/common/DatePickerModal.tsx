import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

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
function applyMode(picked: Date, mode: 'day' | 'month', value: Date | null): Date {
  if (mode !== 'month' || !value) return picked;
  const daysInMonth = new Date(picked.getFullYear(), picked.getMonth() + 1, 0).getDate();
  return new Date(picked.getFullYear(), picked.getMonth(), Math.min(value.getDate(), daysInMonth));
}

export function DatePickerModal(props: DatePickerModalProps) {
  if (Platform.OS === 'android') {
    return <AndroidDatePicker {...props} />;
  }
  return <IosDatePicker {...props} />;
}

function AndroidDatePicker(props: DatePickerModalProps) {
  const { visible, onClose, onPick, onClear, value, mode = 'day' } = props;
  const { t } = useTranslation();
  if (!visible) return null;

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'neutralButtonPressed') {
      onClear?.();
    } else if (event.type === 'set' && selected) {
      onPick(applyMode(selected, mode, value));
    }
    onClose();
  }

  return (
    <DateTimePicker
      value={value ?? new Date()}
      mode="date"
      display="spinner"
      onChange={handleChange}
      minimumDate={minBound(props)}
      maximumDate={maxBound(props)}
      neutralButton={onClear ? { label: t('common.clear') } : undefined}
    />
  );
}

function IosDatePicker(props: DatePickerModalProps) {
  const { visible, onClose, onPick, onClear, value, title, colors, mode = 'day' } = props;
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const [draft, setDraft] = useState<Date>(() => value ?? new Date());

  useEffect(() => {
    if (visible) setDraft(value ?? new Date());
  }, [visible, value]);

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }
  function handleDone() {
    onPick(applyMode(draft, mode, value));
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
    paddingBottom: 28,
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
