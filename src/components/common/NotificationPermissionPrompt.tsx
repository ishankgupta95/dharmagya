import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { MotionPressable } from './MotionPressable';
import { Ornament } from './Ornament';
import { useStore } from '@/store/useStore';
import {
  ensureNotificationPermission,
  getNotificationPermissionState,
} from '@/services/notifications';
import {
  darkColors,
  lightColors,
  borderRadius,
  palette,
  spacing,
} from '@/config/theme';
import { durations } from '@/config/motion';

export type PermissionPromptKind = 'sadhana' | 'tithi' | 'festival';

interface NotificationPermissionPromptProps {
  visible: boolean;
  kind: PermissionPromptKind;
  onCancel: () => void;
  onContinue: () => void;
}

const ICONS: Record<PermissionPromptKind, IconName> = {
  sadhana: 'flame',
  tithi: 'moon',
  festival: 'star',
};

/**
 * The whole "may this notification toggle turn on?" flow, for a screen with
 * one or more such toggles. Render `prompt` once; call `ensurePermission` from
 * a toggle's ON handler and only commit the toggle when it resolves true.
 *
 * - Granted → true at once.
 * - The OS can still ask → this editorial pre-prompt first, whose hint
 *   promises that "the next screen is your phone's permission prompt", then
 *   the system dialog.
 * - The OS will not ask again (iOS after one denial, Android 13+ after two, or
 *   notifications switched off in system settings) → no pre-prompt, since its
 *   promise would be false; straight to the "Open Settings" alert instead
 *   (`ensureNotificationPermission`). iOS never shows its dialog a second
 *   time, so without this a user who once tapped "Don't Allow" had no way
 *   back from inside the app.
 *
 * `granted` is the last known state — read on mount and again whenever the
 * app returns to the foreground (the only way it can change underneath the
 * screen is a trip to Settings). A toggle can skip the async check when it is
 * true and commit in the same tick, so the switch never flickers.
 */
export function useNotificationPermissionGate() {
  const [kind, setKind] = useState<PermissionPromptKind | null>(null);
  const [granted, setGranted] = useState(false);
  // Resolver of the pre-prompt currently on screen, so a toggle can `await`
  // the user's choice.
  const resolveRef = useRef<((proceed: boolean) => void) | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getNotificationPermissionState().then((state) => {
        if (active) setGranted(state.granted);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const close = useCallback((proceed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setKind(null);
    resolve?.(proceed);
  }, []);

  const ensurePermission = useCallback(
    async (promptKind: PermissionPromptKind): Promise<boolean> => {
      const state = await getNotificationPermissionState();
      if (state.granted) {
        setGranted(true);
        return true;
      }
      if (state.canPrompt) {
        // A second toggle while the card is still up settles the first one as
        // declined rather than leaving its handler waiting forever.
        resolveRef.current?.(false);
        const proceed = await new Promise<boolean>((resolve) => {
          resolveRef.current = resolve;
          setKind(promptKind);
        });
        if (!proceed) return false;
      }
      const ok = await ensureNotificationPermission({ promptSettings: true });
      setGranted(ok);
      return ok;
    },
    [],
  );

  const prompt = (
    <NotificationPermissionPrompt
      visible={kind !== null}
      kind={kind ?? 'tithi'}
      onCancel={() => close(false)}
      onContinue={() => close(true)}
    />
  );

  return { granted, ensurePermission, prompt };
}

/**
 * Editorial pre-prompt shown before the system notification dialog. Only show
 * it while the OS can still ask (`NotificationPermissionState.canPrompt`): its
 * hint says the phone's own prompt comes next, which is false once permission
 * has been denied for good. `useNotificationPermissionGate` enforces that.
 */
export function NotificationPermissionPrompt({
  visible,
  kind,
  onCancel,
  onContinue,
}: NotificationPermissionPromptProps) {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}>
        <Animated.View
          entering={FadeIn.duration(durations.base)}
          exiting={FadeOut.duration(durations.fast)}
          style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderAccent }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
            style={styles.sheetInner}>

            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
              <Icon name={ICONS[kind]} size={22} color={colors.accent} />
            </View>

            <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
              {t(`permissionPrompt.${kind}.title`)}
            </Text>

            <Ornament variant="lotus" tone={ornamentTone} style={styles.rule} />

            <Text variant="body" style={[styles.body, { color: colors.textSecondary }]}>
              {t(`permissionPrompt.${kind}.body`)}
            </Text>

            <Text variant="body-italic" style={[styles.hint, { color: colors.textMuted }]}>
              {t('permissionPrompt.systemHint')}
            </Text>

            <View style={styles.actions}>
              <MotionPressable
                onPress={onCancel}
                pressedScale={0.97}
                style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('permissionPrompt.cancelBtn')}>
                <Text variant="mono-caps" style={[styles.btnText, { color: colors.textSecondary }]}>
                  {t('permissionPrompt.cancelBtn')}
                </Text>
              </MotionPressable>
              <MotionPressable
                onPress={onContinue}
                pressedScale={0.97}
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={t('permissionPrompt.continueBtn')}>
                <Text variant="mono-caps" style={[styles.btnText, { color: palette.night }]}>
                  {t('permissionPrompt.continueBtn')}
                </Text>
              </MotionPressable>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 12,
  },
  rule: {
    width: '40%',
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
});
