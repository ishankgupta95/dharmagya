// Font-readiness gate — the runtime-loading implementation, shared by iOS and
// web. It has no platform suffix on purpose: Metro never resolves this file
// for `@/config/fontGate` directly. `fontGate.ios.ts` and `fontGate.web.ts`
// re-export it, and only those two are ever bundled, so the TTFs `require`d
// below reach exactly the platforms that load fonts at runtime and never the
// Android bundle (see `fontGate.ts` for why Android is different).
//
// Two invariants:
//   · The map KEYS must equal the typeScale family strings exactly — that is
//     the name RN looks up (and the `@font-face` family expo-font declares on
//     web). They happen to equal each TTF's basename, which is what the
//     Android plugin registers them as; keep both in lockstep.
//   · Every face is `require`d by SUBPATH. Never import from an
//     `@expo-google-fonts/*` package root: the root module pulls every weight
//     of the family into the bundle (measured 4.5 MB → 2.24 MB in this repo
//     when that was fixed). The 7 faces here are exactly the 7 the Android
//     plugin embeds; add to both or neither.

import { useEffect } from 'react';
import { useFonts } from 'expo-font';

const FONT_MAP = {
  Geist_200ExtraLight: require('@expo-google-fonts/geist/200ExtraLight/Geist_200ExtraLight.ttf'),
  Geist_300Light: require('@expo-google-fonts/geist/300Light/Geist_300Light.ttf'),
  Geist_400Regular: require('@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf'),
  Geist_500Medium: require('@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf'),
  Geist_600SemiBold: require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf'),
  NotoSerifDevanagari_500Medium: require('@expo-google-fonts/noto-serif-devanagari/500Medium/NotoSerifDevanagari_500Medium.ttf'),
  NotoSerifDevanagari_600SemiBold: require('@expo-google-fonts/noto-serif-devanagari/600SemiBold/NotoSerifDevanagari_600SemiBold.ttf'),
};

/**
 * `true` once the 7 faces are registered — or once loading has FAILED. A
 * failure falls back to the system Latin face (San Francisco on iOS) and the
 * system Devanagari face for Hindi, which is ugly but usable; holding the
 * splash forever is neither.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_MAP);

  useEffect(() => {
    if (error) {
      console.warn('[fonts] runtime font load failed — continuing on system fonts', error);
    }
  }, [error]);

  return loaded || error !== null;
}
