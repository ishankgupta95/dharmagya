import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useStore } from '@/store/useStore';

// A 128px tileable warm-noise tile (dark fibres + light flecks on transparent).
// Rendered once, app-wide, as a faint film over the whole UI so flat parchment
// / night-plinth fields read as printed paper rather than digital fills. This
// is the "stacked small detail" that lifts the Sacred Editorial look.
const GRAIN = require('../../../assets/images/grain.png');

const isDarkSelector = (s: { isDarkMode: boolean }) => s.isDarkMode;

/**
 * Global paper-grain layer. Mount once at the top of the view tree (above
 * content, below modals) with `pointerEvents="none"`. Static single layer —
 * composited once, never re-renders except on theme flip, so it is safe on
 * the Pixel 3a gate device.
 */
export const GrainOverlay = memo(function GrainOverlay() {
  const isDark = useStore(isDarkSelector);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={GRAIN}
        resizeMode="repeat"
        fadeDuration={0}
        // Tile is baked to read at ~0.5-0.7 layer opacity (effective per-speck
        // ~5-8%). Night plinth runs a touch hotter so the light flecks read as
        // faint stars. Both are eyeball-tunable one-liners.
        style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.7 : 0.55 }]}
      />
    </View>
  );
});
