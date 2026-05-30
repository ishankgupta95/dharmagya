import { Platform, type TextStyle } from 'react-native';

// ─── Color Palette type (shared interface for dark & light) ──────────────────

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
  [key: string]: string; // allows surfaceAccent on light mode
}

// ─── Sacred Editorial palette (raw tokens — P6.1) ────────────────────────────
// Hex values sourced from design/redesign-preview.html (2026-04-20 study).
// Primitives in P6.2+ reference `palette.*` directly; screens continue to read
// semantic `lightColors` / `darkColors` keys, which now map to these.

export const palette = {
  // Ground
  parchment: '#F4E9CE',
  parchmentDeep: '#E8D9B4',
  parchmentBright: '#FBF3DE',
  paperEdge: '#D9C799',

  // Ink
  ink: '#1B140A',
  inkSoft: '#3A2F1F',
  inkQuiet: '#6A5A40',
  inkMuted: '#9A8A6C',

  // Ornament
  sindoor: '#A5301C',
  sindoorDeep: '#782110',
  sindoorWarm: '#C54927',
  goldLeaf: '#C99B3A',
  gold: '#9C7623',
  nightPlinth: '#2B1A0F',
  nightPlinthDeep: '#1A1008',

  // Rules
  rule: '#B8A670',
  ruleSoft: '#D4C28C',

  // Bone-white, used as text on dark plinth cards
  boneWhite: '#F3E5C8',
} as const;

// ─── Semantic Color Tokens (mapped to palette — P6.1) ────────────────────────
// Same keys as before; values now sourced from the Sacred Editorial palette.
// P6.2+ screens read through these — no mass-rename needed.

export const darkColors = {
  base: palette.nightPlinthDeep,
  surface: palette.nightPlinth,
  surfaceRecessed: palette.nightPlinthDeep,
  textPrimary: palette.boneWhite,
  textSecondary: 'rgba(243,229,200,0.82)',
  textTertiary: 'rgba(243,229,200,0.62)',
  textMuted: 'rgba(243,229,200,0.45)',
  textDisabled: 'rgba(243,229,200,0.28)',
  accent: palette.goldLeaf,
  // `emphasis` is used for refrain lines, italicised tail syllables, and "see all"
  // links — anywhere sindoor-deep was used on a theme-responsive surface in P6.
  // On nightPlinthDeep, sindoorDeep (#782110) is 1.78:1 contrast — fails WCAG AA.
  // Dark-mode emphasis uses goldLeaf (7.28:1) which reads as editorial gold and
  // keeps the typographic hierarchy without the red becoming invisible.
  emphasis: palette.goldLeaf,
  border: 'rgba(243,229,200,0.08)',
  borderAccent: 'rgba(201,155,58,0.22)',
  divider: 'rgba(243,229,200,0.08)',
} as const;

export const lightColors = {
  base: palette.parchment,
  surface: palette.parchmentBright,
  surfaceRecessed: palette.parchmentDeep,
  surfaceAccent: palette.parchmentBright,
  textPrimary: palette.ink,
  textSecondary: palette.inkSoft,
  textTertiary: palette.inkQuiet,
  textMuted: palette.inkMuted,
  textDisabled: 'rgba(27,20,10,0.32)',
  accent: palette.sindoor,
  emphasis: palette.sindoorDeep,
  border: 'rgba(27,20,10,0.10)',
  borderAccent: 'rgba(165,48,28,0.18)',
  divider: palette.rule,
} as const;

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
  error: '#E24B4A',
  info: '#4A9EF5',
} as const;

// ─── Spacing & Radius ────────────────────────────────────────────────────────

export const spacing = {
  screenH: 24,       // Screen horizontal padding
  cardPad: 16,       // Card internal padding (min)
  cardPadLg: 20,     // Card internal padding (max)
  cardGap: 16,       // Vertical gap between cards
  gridGap: 12,       // Grid gap
  sectionGap: 12,    // Section label to content
} as const;

export const borderRadius = {
  card: 16,
  cardInner: 14,
  iconContainer: 12,
  chip: 20,
  button: 14,
  avatar: 9999,
} as const;

// ─── Sacred Editorial type scale (P6.1) ──────────────────────────────────────
// Each entry returns a TextStyle fragment — spread onto a StyleSheet rule.
// Screens should call `...typeScale.displayItalic` instead of hard-coding
// font family + style so P6.9 can retune everything in one place.

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontStyle' | 'fontVariant' | 'fontWeight' | 'letterSpacing' | 'textTransform'>;

// Platform mono — Menlo on iOS, 'monospace' on Android. Replaces JetBrainsMono
// (P11.4 drop). System mono on Android renders identically for kicker /
// timestamp use; iOS Menlo is the editorial mono alternative.
export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const typeScale = {
  // 30–88px editorial headlines. Light-weight Fraunces with tight tracking.
  displaySerif: {
    fontFamily: 'Fraunces_300Light',
    letterSpacing: -0.5,
  },
  // Italic counterpart — "Good *morning*", masthead, hero emphasis.
  displayItalic: {
    fontFamily: 'Fraunces_300Light_Italic',
    fontStyle: 'italic',
    letterSpacing: -0.4,
  },
  // Body paragraphs — Fraunces at reading weight.
  bodySerif: {
    fontFamily: 'Fraunces_400Regular',
    letterSpacing: 0,
  },
  // Italic body — lede copy, transliterations, deity taglines.
  bodyItalic: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontStyle: 'italic',
    letterSpacing: 0,
  },
  // Devanagari text — hi-title rows, mantras, transliteration.
  deva: {
    fontFamily: 'NotoSerifDevanagari_500Medium',
    letterSpacing: 0.1,
  },
  devaBold: {
    fontFamily: 'NotoSerifDevanagari_700Bold',
    letterSpacing: 0.1,
  },
  // Mono data — timestamps, astronomical figures, kickers.
  mono: {
    fontFamily: MONO_FONT,
    letterSpacing: 0.3,
  },
  // Small-caps mono kicker — "Aarti № XX", section labels.
  monoCaps: {
    fontFamily: MONO_FONT,
    fontWeight: '500',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  // On-brand figures — Fraunces with lining + tabular numerals so columns of
  // times/counts stay aligned (fixed-width digits) while reading as the
  // editorial serif rather than stock system mono. Use for NUMBER displays
  // (times, counts, degrees); mono-caps labels keep their mono face.
  figures: {
    fontFamily: 'Fraunces_400Regular',
    fontVariant: ['lining-nums', 'tabular-nums'],
    letterSpacing: 0,
  },
  figuresMedium: {
    fontFamily: 'Fraunces_500Medium',
    fontVariant: ['lining-nums', 'tabular-nums'],
    letterSpacing: 0,
  },
} as const satisfies Record<string, TypeToken>;
