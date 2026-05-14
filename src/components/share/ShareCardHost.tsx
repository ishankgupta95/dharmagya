import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Ornament } from '@/components/common/Ornament';
import { useStore } from '@/store/useStore';
import { useShareSheet } from '@/store/useShareSheet';
import { borderRadius, darkColors, lightColors, palette, spacing } from '@/config/theme';
import { resolveShareContent, type ShareStrings } from './content';
import { CARD_DIMS, ShareCard, type ShareCardShape } from './ShareCard';

/** Capture scale — design is 540 dp wide; 2× → 1080 px (WhatsApp Status spec). */
const CAPTURE_SCALE = 2;

/**
 * Singleton host for shareable cards (P14.5) — mounted once in `app/_layout.tsx`.
 * Renders the requested `ShareCard` off-screen, captures it to a 1080-px PNG via
 * `react-native-view-shot`, and presents a preview sheet with a Story/Square
 * toggle, "Share" (system share sheet via `expo-sharing`) and "Save to Gallery"
 * (`expo-media-library`). All app chrome here is themed + bilingual; the card
 * itself is fixed-pixel and language-independent.
 */
export function ShareCardHost() {
  const { t } = useTranslation();
  const spec = useShareSheet((s) => s.spec);
  const close = useShareSheet((s) => s.close);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

  const [shape, setShape] = useState<ShareCardShape>('story');
  const [uri, setUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const busyRef = useRef(false);

  const strings = useMemo<ShareStrings>(() => ({
    kickerDeityBlessing: t('share.kickerDeityBlessing'),
    kickerFestival: t('share.kickerFestival'),
    kickerVerse: t('share.kickerVerse'),
    kickerJaap: t('share.kickerJaap'),
    jaapCountLine: (count: number) => t('share.jaapCountLine', { count }),
  }), [t]);

  const content = useMemo(() => (spec ? resolveShareContent(spec, strings) : null), [spec, strings]);

  // Reset every time a new share is requested.
  useEffect(() => {
    if (spec) {
      setShape('story');
      setUri(null);
      busyRef.current = false;
    }
  }, [spec]);

  const cardRef = useRef<View>(null);

  const capture = useCallback(async () => {
    if (busyRef.current || !content) return;
    busyRef.current = true;
    try {
      const { w, h } = CARD_DIMS[shape];
      // One frame after layout/decode so the off-screen tree is committed.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const out = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: Math.round(w * CAPTURE_SCALE),
        height: Math.round(h * CAPTURE_SCALE),
      });
      setUri(out);
    } catch {
      Alert.alert(t('share.error'));
      close();
    } finally {
      busyRef.current = false;
    }
  }, [content, shape, t, close]);

  const handleCardReady = useCallback(() => { void capture(); }, [capture]);

  // Safety net: if the off-screen card's onReady never fires (e.g. an image's
  // onLoad is swallowed), capture anyway after a short grace period.
  useEffect(() => {
    if (!spec || uri) return;
    const id = setTimeout(() => { void capture(); }, 1800);
    return () => clearTimeout(id);
  }, [spec, shape, uri, capture]);

  const onPickShape = useCallback((next: ShareCardShape) => {
    if (next === shape) return;
    setUri(null);
    busyRef.current = false;
    setShape(next);
  }, [shape]);

  const onShare = useCallback(async () => {
    if (!uri) return;
    setWorking(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.title'), UTI: 'public.png' });
      }
    } catch { /* user cancelled / unavailable — nothing to do */ } finally {
      setWorking(false);
    }
  }, [uri, t]);

  const onSave = useCallback(async () => {
    if (!uri) return;
    setWorking(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('share.permissionDenied')); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('share.savedToast'));
    } catch {
      Alert.alert(t('share.error'));
    } finally {
      setWorking(false);
    }
  }, [uri, t]);

  if (!spec || !content) return null;

  const previewDim = CARD_DIMS[shape];
  const previewW = 260;
  const previewH = Math.round((previewW * previewDim.h) / previewDim.w);

  return (
    <>
      {/* Off-screen render target. Positioned far off the layout box but still
          attached + drawn, which `captureRef` requires. `key={shape}` forces a
          remount so the portrait's onLoad re-fires after a shape switch. */}
      <View pointerEvents="none" style={styles.offscreen}>
        <ShareCard key={shape} content={content} shape={shape} cardRef={cardRef} onReady={handleCardReady} />
      </View>

      <Modal visible transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.close')}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>

            <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
              {t('share.title')}
            </Text>
            <Ornament variant="lotus" tone={isDarkMode ? 'dark' : 'light'} style={styles.rule} />

            {/* Preview */}
            <View style={[styles.previewWrap, { width: previewW, height: previewH, backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
              {uri ? (
                <Image source={{ uri }} style={{ width: previewW, height: previewH, borderRadius: 10 }} resizeMode="cover" />
              ) : (
                <ActivityIndicator color={colors.accent} />
              )}
            </View>

            {/* Shape toggle */}
            <View style={styles.shapeRow}>
              {(['story', 'square'] as const).map((s) => {
                const active = shape === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => onPickShape(s)}
                    activeOpacity={0.85}
                    style={[styles.shapeChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.surfaceRecessed : 'transparent' }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <Text variant="mono-caps" style={[styles.shapeChipText, { color: active ? colors.accent : colors.textSecondary }]}>
                      {t(s === 'story' ? 'share.shapeStory' : 'share.shapeSquare')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={onSave}
                disabled={!uri || working}
                activeOpacity={0.85}
                style={[styles.actionBtn, styles.actionSecondary, { borderColor: colors.borderAccent, opacity: !uri || working ? 0.5 : 1 }]}
                accessibilityRole="button">
                <Icon name="apps" size={15} color={colors.accent} />
                <Text variant="mono-caps" style={[styles.actionText, { color: colors.accent }]}>{t('share.saveBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onShare}
                disabled={!uri || working}
                activeOpacity={0.85}
                style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: colors.accent, opacity: !uri || working ? 0.5 : 1 }]}
                accessibilityRole="button">
                {working ? (
                  <ActivityIndicator color={palette.parchmentBright} size="small" />
                ) : (
                  <>
                    <Icon name="share" size={15} color={palette.parchmentBright} />
                    <Text variant="mono-caps" style={[styles.actionText, { color: palette.parchmentBright }]}>{t('share.shareBtn')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text variant="body-italic" style={[styles.hint, { color: colors.textMuted }]}>
              {t('share.statusHint')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Rendered off the layout box (not display:none / opacity:0 — react-native-view-shot
  // captures those as blank), so it's painted but never visible to the user.
  offscreen: { position: 'absolute', left: -10000, top: -10000 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: spacing.screenH,
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: { fontSize: 24, lineHeight: 30 },
  rule: { width: '40%', marginTop: 8, marginBottom: 18 },

  previewWrap: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  shapeRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  shapeChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: borderRadius.chip, borderWidth: 1 },
  shapeChipText: { fontSize: 9 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20, alignSelf: 'stretch' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: borderRadius.button,
  },
  actionSecondary: { borderWidth: 1 },
  actionPrimary: {},
  actionText: { fontSize: 10 },

  hint: { fontSize: 12, lineHeight: 17, marginTop: 14, textAlign: 'center', paddingHorizontal: 8 },
});
