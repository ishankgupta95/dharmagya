import { memo, useCallback } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MONO_FONT, palette } from '@/config/theme';
import { CornerBrackets } from '@/components/common/CornerBrackets';
import type { ShareCardContent } from './content';

export type ShareCardShape = 'story' | 'square';

/** Design (and capture-input) width in dp. The host captures at 2× → 1080 px. */
export const CARD_W = 540;
export const CARD_DIMS: Record<ShareCardShape, { w: number; h: number }> = {
  story: { w: CARD_W, h: CARD_W * (16 / 9) }, // 540 × 960  → 1080 × 1920
  square: { w: CARD_W, h: CARD_W }, //              540 × 540  → 1080 × 1080
};

const BONE = palette.boneWhite;
const BONE_SOFT = 'rgba(243,229,200,0.78)';
const BONE_QUIET = 'rgba(243,229,200,0.58)';

interface ShareCardProps {
  content: ShareCardContent;
  shape: ShareCardShape;
  /** Forwarded to the root View so the host can `captureRef` it. */
  cardRef: React.RefObject<View | null>;
  /** Called once the card is laid out and (if any) its portrait has decoded. */
  onReady: () => void;
}

/**
 * A single shareable card, rendered off-screen at 540 dp wide (P14.5). Pure
 * function of `content` + `shape`; uses raw `Text` (not `AppText`) so the
 * user's font-size setting never alters the exported image. Every card carries
 * gold corner brackets, a thin rule, and the app-name watermark in the footer.
 */
export const ShareCard = memo(function ShareCard({ content, shape, cardRef, onReady }: ShareCardProps) {
  const { w, h } = CARD_DIMS[shape];
  const hasImage = !!content.image;

  // Capture-readiness: with a portrait, wait for the image's onLoad; without
  // one, the layout is synchronous so onLayout is enough.
  const handleImageLoad = useCallback(() => onReady(), [onReady]);
  const handleLayout = useCallback(() => { if (!hasImage) onReady(); }, [hasImage, onReady]);

  return (
    <View
      ref={cardRef}
      collapsable={false}
      onLayout={handleLayout}
      style={[styles.root, { width: w, height: h }]}>

      {/* ── Background ─────────────────────────────────────────────────────── */}
      {hasImage ? (
        <>
          <Image source={content.image!} resizeMode="cover" style={StyleSheet.absoluteFill} onLoad={handleImageLoad} />
          <LinearGradient
            colors={['rgba(15,9,3,0.55)', 'transparent']}
            style={[styles.fill, { bottom: undefined, height: h * 0.42 }]}
          />
          <LinearGradient
            colors={['transparent', 'rgba(15,9,3,0.45)', 'rgba(15,9,3,0.94)']}
            locations={[0, 0.5, 1]}
            style={[styles.fill, { top: h * 0.32 }]}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={[`${content.accent}D9`, palette.nightPlinthDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.fallbackHaloOuter, { top: h * 0.16 }]} />
          <View style={[styles.fallbackHaloInner, { top: h * 0.16 + 14 }]} />
          <Text style={[styles.fallbackInitial, { top: h * 0.16 + 14 }]}>{content.initial}</Text>
        </>
      )}

      <CornerBrackets color={palette.goldLeaf} length={34} thickness={1.4} inset={22} />

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <View style={styles.contentWrap}>
        <View style={styles.topRow}>
          {content.topBadge ? <Text style={styles.topBadge}>{content.topBadge}</Text> : null}
        </View>

        <View style={styles.bottomBlock}>
          <Text style={styles.kicker} numberOfLines={1}>{content.kicker}</Text>

          {content.verseLayout ? (
            <>
              <Text style={styles.verseHi} numberOfLines={7}>{content.focalHi}</Text>
              {content.focalEn ? <Text style={styles.verseEn} numberOfLines={5}>{content.focalEn}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.nameHi} numberOfLines={2}>{content.focalHi}</Text>
              {content.focalEn ? <Text style={styles.nameEn} numberOfLines={2}>{content.focalEn}</Text> : null}
              {content.subHi ? <Text style={styles.subHi} numberOfLines={3}>{content.subHi}</Text> : null}
              {content.subEn ? <Text style={styles.subEn} numberOfLines={2}>{content.subEn}</Text> : null}
            </>
          )}

          {content.source ? <Text style={styles.source} numberOfLines={1}>{content.source}</Text> : null}

          <View style={styles.rule} />

          <View style={styles.watermark}>
            <Text style={styles.watermarkOm}>ॐ</Text>
            <Text style={styles.watermarkName}>dharmagya</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: palette.nightPlinthDeep },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  fallbackHaloOuter: {
    position: 'absolute', alignSelf: 'center',
    width: 210, height: 210, borderRadius: 105,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(243,229,200,0.28)',
  },
  fallbackHaloInner: {
    position: 'absolute', alignSelf: 'center',
    width: 182, height: 182, borderRadius: 91,
    borderWidth: 1, borderColor: 'rgba(243,229,200,0.42)',
  },
  fallbackInitial: {
    position: 'absolute', alignSelf: 'center',
    width: 182, height: 182, textAlign: 'center', textAlignVertical: 'center',
    lineHeight: 182, fontSize: 96,
    fontFamily: 'NotoSerifDevanagari_700Bold', color: 'rgba(243,229,200,0.95)',
  },

  contentWrap: { flex: 1, padding: 40, justifyContent: 'space-between' },
  topRow: { minHeight: 28, alignItems: 'center' },
  topBadge: {
    fontFamily: 'Fraunces_300Light_Italic', fontStyle: 'italic',
    fontSize: 22, lineHeight: 28, color: BONE, textAlign: 'center', letterSpacing: -0.3,
  },

  bottomBlock: {},
  kicker: {
    fontFamily: 'NotoSerifDevanagari_500Medium',
    fontSize: 11, letterSpacing: 3, color: palette.goldLeaf,
    textTransform: 'uppercase', marginBottom: 10,
  },

  nameHi: { fontFamily: 'NotoSerifDevanagari_700Bold', fontSize: 36, lineHeight: 46, color: BONE },
  nameEn: { fontFamily: 'Fraunces_400Regular_Italic', fontStyle: 'italic', fontSize: 17, lineHeight: 24, color: BONE_SOFT, marginTop: 4 },
  subHi: { fontFamily: 'NotoSerifDevanagari_500Medium', fontSize: 17, lineHeight: 27, color: BONE_SOFT, marginTop: 12 },
  subEn: { fontFamily: 'Fraunces_400Regular_Italic', fontStyle: 'italic', fontSize: 14, lineHeight: 20, color: BONE_QUIET, marginTop: 6 },

  verseHi: { fontFamily: 'NotoSerifDevanagari_700Bold', fontSize: 25, lineHeight: 39, color: BONE },
  verseEn: { fontFamily: 'Fraunces_400Regular_Italic', fontStyle: 'italic', fontSize: 15, lineHeight: 23, color: BONE_SOFT, marginTop: 12 },

  source: { fontFamily: 'Fraunces_400Regular_Italic', fontStyle: 'italic', fontSize: 12.5, lineHeight: 18, color: BONE_QUIET, marginTop: 14 },

  rule: { width: 64, height: 1.2, backgroundColor: palette.goldLeaf, opacity: 0.6, marginTop: 20, marginBottom: 14 },
  watermark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  watermarkOm: { fontFamily: 'NotoSerifDevanagari_500Medium', fontSize: 14, color: 'rgba(243,229,200,0.6)' },
  watermarkName: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 4, color: 'rgba(243,229,200,0.6)' },
});
