// Font-readiness gate — iOS half. Metro picks this file over `fontGate.ts`
// when bundling for iOS. Nothing is embedded natively there (no `expo-font`
// plugin entry on purpose — it would register the TTFs under their PostScript
// names, which do not match the `theme.ts` family strings), so iOS loads the
// same 7 files at runtime under the exact keys Android embeds them as. The
// implementation, and the TTF `require`s, live in `fontGate.runtime.ts`; web
// re-exports the same one.

export { useAppFonts } from './fontGate.runtime';
