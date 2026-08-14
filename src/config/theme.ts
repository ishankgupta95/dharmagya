import { Platform, type TextStyle } from 'react-native';

// ─── Diya — design tokens ────────────────────────────────────────────────────
// Replaces the Sacred Editorial palette (design_handoff_diya, 2026-08-13).
// A dark room with one warm light in it: deep aubergine night + warm rice
// light, one turmeric accent. The OS supplies the chrome (Liquid Glass on iOS,
// Material 3 on Android); ornament is gone — hierarchy is size, space and the
// single accent.
//
// Every exported name from the Sacred Editorial theme is kept so existing
// screens keep compiling. Legacy keys (palette.sindoor, typeScale.displaySerif,
// …) are aliased onto their nearest Diya equivalent and marked deprecated —
// new code reads the Diya names.

export interface ColorPalette {
  base: string;
  surface: string;
  surfaceRecessed: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textDisabled: string;
  accent: string;
  border: string;
  borderAccent: string;
  divider: string;
  [key: string]: string; // extra per-scheme keys (surfaceAccent, glass, …)
}

export const palette = {
  // Ground — deep aubergine night
  night:          '#171220',
  nightDeep:      '#0B0810',
  nightRaised:    '#241C30',
  glassTint:      'rgba(45,35,60,0.60)',

  // Ground — warm rice light
  rice:           '#F8F4F2',
  riceCard:       '#FFFFFF',
  ricePaper:      '#FBF8F4',   // reader only, one step warmer
  riceSunken:     '#F2EBEF',

  // Ink
  bone:           '#EDE8F0',
  ink:            '#221B24',
  inkSoft:        '#4A4150',
  inkQuiet:       '#6B6070',

  // Accent — turmeric. Two values, one role.
  // `turmeric` for fills, dots, rings, selected chips, ring progress.
  // `turmericInk` wherever the accent must be READ as words on a light ground
  // (5.90:1 on rice, 6.45:1 on white). On dark, turmeric itself is 8.02:1.
  turmeric:       '#D8A31A',
  turmericInk:    '#7A5900',
  turmericSoft:   '#FFF3D1',   // light-mode accent container
  turmericGlow:   'rgba(216,163,26,0.35)',

  // Alert
  rose:           '#D2405C',   // dark-mode inauspicious
  roseText:       '#E4708A',
  crimson:        '#B3261E',   // light-mode inauspicious
  crimsonText:    '#8C1D18',
  crimsonSoft:    '#FFEDEC',

  // ── Legacy Sacred Editorial keys (deprecated — nearest Diya equivalent) ──
  // Kept so un-ported call sites compile and pick up the new scheme at once.
  /** @deprecated use `rice` */
  parchment:      '#F8F4F2',
  /** @deprecated use `riceSunken` */
  parchmentDeep:  '#F2EBEF',
  /** @deprecated use `riceCard` */
  parchmentBright:'#FFFFFF',
  /** @deprecated hairline on rice — prefer semantic `border` */
  paperEdge:      '#E2DBDF',
  /** @deprecated use `inkQuiet` */
  inkMuted:       '#8A8090',
  /** @deprecated light-mode accent text — use `turmericInk` */
  sindoor:        '#7A5900',
  /** @deprecated use `turmericInk` (darker step) */
  sindoorDeep:    '#5C4300',
  /** @deprecated accent fill — use `turmeric` */
  sindoorWarm:    '#D8A31A',
  /** @deprecated dark-mode accent — use `turmeric` */
  goldLeaf:       '#D8A31A',
  /** @deprecated light-mode accent text — use `turmericInk` */
  gold:           '#7A5900',
  /** @deprecated use `nightRaised` */
  nightPlinth:    '#241C30',
  /** @deprecated use `nightDeep` */
  nightPlinthDeep:'#0B0810',
  /** @deprecated hairline divider — prefer semantic `divider` */
  rule:           '#DED6DA',
  /** @deprecated hairline divider — prefer semantic `divider` */
  ruleSoft:       '#E8E1E5',
  /** @deprecated use `bone` */
  boneWhite:      '#EDE8F0',
} as const;

export const darkColors = {
  base:            palette.night,
  surface:         'rgba(255,255,255,0.045)',
  surfaceRaised:   palette.nightRaised,
  surfaceRecessed: palette.nightDeep,
  surfaceAccent:   'rgba(216,163,26,0.10)',
  glass:           palette.glassTint,
  textPrimary:     palette.bone,
  textSecondary:   'rgba(237,232,240,0.62)',
  textTertiary:    'rgba(237,232,240,0.45)',
  textMuted:       'rgba(237,232,240,0.35)',
  textDisabled:    'rgba(237,232,240,0.22)',
  accent:          palette.turmeric,
  accentText:      palette.turmeric,
  accentSurface:   'rgba(216,163,26,0.10)',
  emphasis:        palette.turmeric,
  border:          'rgba(255,255,255,0.08)',
  borderAccent:    'rgba(216,163,26,0.24)',
  divider:         'rgba(255,255,255,0.06)',
  danger:          palette.rose,
  dangerText:      palette.roseText,
  dangerSurface:   'rgba(210,64,92,0.10)',
} as const;

export const lightColors = {
  base:            palette.rice,
  surface:         palette.riceCard,
  surfaceRaised:   palette.riceCard,
  surfaceRecessed: palette.riceSunken,
  surfaceAccent:   '#FFF9E6',
  glass:           'rgba(252,250,249,0.66)',
  textPrimary:     palette.ink,
  textSecondary:   'rgba(34,27,36,0.68)',
  textTertiary:    'rgba(34,27,36,0.50)',
  textMuted:       'rgba(34,27,36,0.42)',
  textDisabled:    'rgba(34,27,36,0.28)',
  accent:          palette.turmeric,      // fills, dots, rings
  accentText:      palette.turmericInk,   // accent-as-words — AA at body sizes
  accentSurface:   '#FFF9E6',
  emphasis:        palette.turmericInk,
  border:          'rgba(34,27,36,0.07)',
  borderAccent:    'rgba(168,122,0,0.22)',
  divider:         'rgba(34,27,36,0.07)',
  danger:          palette.crimson,
  dangerText:      palette.crimsonText,
  dangerSurface:   palette.crimsonSoft,
} as const;

// Unchanged from Sacred Editorial — the redesign reuses these hex-for-hex.
export const deityColors: Record<string, string> = {
  ganesha: '#E8893C',
  shiva: '#7AA8C8',
  lakshmi: '#D4A853',
  vishnu: '#5DCAA5',
  hanuman: '#E85D3A',
  krishna: '#4A7ABF',
  rama: '#5EA06A',
  durga: '#D45454',
  saraswati: '#B0A0D8',
  parvati: '#E07878',
  kali: '#8B5CF6',
  surya: '#F0A030',
  brahma: '#D4A060',
  'sai-baba': '#A0886A',
  'santoshi-mata': '#E8A060',
  sita: '#D4876E',
  'khatu-shyam': '#4A90D9',
  'vaishno-devi': '#E05070',
  narasimha: '#D4A030',
};

export const semanticColors = {
  success: '#5DCAA5',
  error:   '#E24B4A',
  info:    '#4A9EF5',
  auspicious: '#5DCAA5',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  screenH:    24,  // screen horizontal padding (20 on Android, 32 on tablet)
  screenHAndroid: 20,
  cardPad:    18,
  cardPadLg:  20,
  cardGap:    12,
  gridGap:    10,
  sectionGap: 16,
  railGap:     8,
} as const;

// ─── Radius ──────────────────────────────────────────────────────────────────
// Android runs one step larger than iOS — Material 3 Expressive is rounder.
export const borderRadius = {
  hero:         24,   // Android 28
  card:         22,   // Android 26
  list:         20,
  tile:         20,
  control:      12,
  chip:         19,
  button:       27,   // pill: half of the 54px control height
  tabBar:       33,
  sheet:        30,
  avatar:     9999,
  /** @deprecated use `list` */
  cardInner:    18,
  /** @deprecated use `control` */
  iconContainer: 14,
} as const;

export const controlHeight = {
  button:  54,
  field:   44,
  segment: 36,
  chip:    36,
  tabBar:  66,   // iOS floating glass; Android nav bar is 82 and anchored
  tabBarLarge: 92, // Dynamic Type ≥1.3×
} as const;

// ─── Elevation ───────────────────────────────────────────────────────────────
// On dark, elevation is an edge plus ambient darkness — never a stacked shadow.
export const shadow = {
  dark: {
    card:   { shadowColor: '#000', shadowOpacity: 0.00, shadowRadius: 0,  elevation: 0 },
    glass:  { shadowColor: '#000', shadowOpacity: 0.50, shadowRadius: 36, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
    accent: { shadowColor: palette.turmeric, shadowOpacity: 0.30, shadowRadius: 28, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  },
  light: {
    card:   { shadowColor: '#221B24', shadowOpacity: 0.05, shadowRadius: 4,  shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    glass:  { shadowColor: '#221B24', shadowOpacity: 0.13, shadowRadius: 30, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
    accent: { shadowColor: palette.turmeric, shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  },
} as const;

// ─── Type ────────────────────────────────────────────────────────────────────
// Geist for all Latin UI and figures. Noto Serif Devanagari for every
// Devanagari string — names, mantras, verse. Fraunces and DM Sans are dropped.

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontStyle' | 'fontVariant' | 'letterSpacing' | 'textTransform'>;

export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const typeScale = {
  // Latin display — the large date, big counts. Light weight, tight tracking.
  display:      { fontFamily: 'Geist_300Light',    letterSpacing: -1.0 },  // 36–44
  displaySmall: { fontFamily: 'Geist_300Light',    letterSpacing: -0.7 },  // 27–30
  countHero:    { fontFamily: 'Geist_200ExtraLight', letterSpacing: -3.0, fontVariant: ['tabular-nums'] }, // 78, jaap only

  // Latin UI
  title:        { fontFamily: 'Geist_500Medium',   letterSpacing: -0.1 },  // 15–19
  body:         { fontFamily: 'Geist_400Regular',  letterSpacing: 0 },     // 14–15
  bodySmall:    { fontFamily: 'Geist_400Regular',  letterSpacing: 0 },     // 12.5
  button:       { fontFamily: 'Geist_600SemiBold', letterSpacing: 0 },     // 16

  // Kickers — the uppercase micro-labels that head every card and ledger row
  kicker:       { fontFamily: 'Geist_500Medium', letterSpacing: 1.6, textTransform: 'uppercase' }, // 10.5
  kickerSmall:  { fontFamily: 'Geist_500Medium', letterSpacing: 1.3, textTransform: 'uppercase' }, // 9.5

  // Devanagari
  deva:         { fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0 },
  devaBold:     { fontFamily: 'NotoSerifDevanagari_600SemiBold', letterSpacing: 0 },
  devaVerse:    { fontFamily: 'NotoSerifDevanagari_500Medium', letterSpacing: 0 }, // lineHeight 1.75–1.9

  // Every time, count and duration in the app
  mono:         { fontFamily: 'Geist_400Regular', fontVariant: ['tabular-nums'], letterSpacing: 0.2 },

  // ── Legacy Sacred Editorial keys (deprecated — alias onto Diya faces) ──
  // Display italics are gone from the design language; the italic keys map to
  // the upright faces so un-ported screens quietly lose the flourish.
  /** @deprecated use `display` */
  displaySerif: { fontFamily: 'Geist_300Light', letterSpacing: -0.7 },
  /** @deprecated italics dropped — use `display` */
  displayItalic:{ fontFamily: 'Geist_300Light', letterSpacing: -0.7 },
  /** @deprecated use `body` */
  bodySerif:    { fontFamily: 'Geist_400Regular', letterSpacing: 0 },
  /** @deprecated italics dropped — use `body` */
  bodyItalic:   { fontFamily: 'Geist_400Regular', letterSpacing: 0 },
  /** @deprecated use `kicker` */
  monoCaps:     { fontFamily: 'Geist_500Medium', letterSpacing: 1.6, textTransform: 'uppercase' },
  /** @deprecated use `mono` */
  figures:      { fontFamily: 'Geist_500Medium', fontVariant: ['tabular-nums'], letterSpacing: 0 },
  /** @deprecated use `mono` */
  figuresMedium:{ fontFamily: 'Geist_600SemiBold', fontVariant: ['tabular-nums'], letterSpacing: 0 },
} as const satisfies Record<string, TypeToken>;

// Verse and mantra need far more leading than Latin body copy.
export const lineHeight = {
  verse:  1.80,
  mantra: 1.55,
  body:   1.65,
  tight:  1.20,
} as const;

// ─── Dynamic Type ────────────────────────────────────────────────────────────
// Past 1.3× the panchang ledger stops being rows: the label moves onto its own
// line above the value. Every label column is a minWidth, never a width, so
// text pushes the row wider instead of clipping.
export const LEDGER_STACK_SCALE = 1.3;
export const ledgerLabelMinWidth = 70;
