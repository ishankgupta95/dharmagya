// Font-readiness gate — web half. Metro picks this file over `fontGate.ts`
// when bundling for web. There is no config-plugin path on web at all: the
// only way the `theme.ts` family strings resolve is expo-font's `useFonts`,
// which injects one `@font-face` rule per key. Without this file web would
// fall through to the Android no-op and render every screen in the browser's
// fallback faces. The implementation, and the TTF `require`s, live in
// `fontGate.runtime.ts`; iOS re-exports the same one.

export { useAppFonts } from './fontGate.runtime';
