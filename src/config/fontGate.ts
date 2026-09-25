// Font-readiness gate — Android half, and the file TypeScript type-checks
// against. Metro's platform-extension resolution picks a sibling instead of
// this one for the other two platforms: `fontGate.ios.ts` on iOS and
// `fontGate.web.ts` on web, both of which re-export the runtime loader in
// `fontGate.runtime.ts`. Android has neither `.android.ts` nor `.native.ts`
// sibling, so it resolves here.
//
// Why the split:
//   · Android embeds all 7 faces natively via the `expo-font` config plugin
//     (app.json → plugins → expo-font → android.fonts). Each TTF lands in
//     `android/app/src/main/assets/fonts/` under its own basename, and
//     ReactFontManager resolves `fontFamily` against exactly that basename, so
//     the `theme.ts` typeScale strings (`Geist_400Regular`,
//     `NotoSerifDevanagari_500Medium`, …) work with nothing to load at runtime.
//     Re-adding `useFonts` here would make Metro emit the same TTFs into
//     `res/raw` a second time — do not. This file must stay a constant `true`
//     and must never `require` a TTF.
//   · iOS has no plugin entry on purpose. The plugin would register the TTFs
//     under their PostScript names, which do not match the basename strings
//     above, so iOS loads the same 7 files at runtime under those exact keys
//     instead. One set of family strings, both platforms.
//   · Web has no plugin path at all; `useFonts` is what injects the
//     `@font-face` rules, so web takes the runtime loader too.
//   Because only `fontGate.runtime.ts` `require`s the TTFs, and only the iOS
//   and web entry files import it, the Android bundle never carries them.
//
// So on Android there is nothing to wait for: always ready.

export function useAppFonts(): boolean {
  return true;
}
