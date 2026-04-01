import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';

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

// ─── Color Tokens ────────────────────────────────────────────────────────────

export const darkColors = {
  base: '#1A1A1F',
  surface: '#222228',
  surfaceRecessed: '#2A2A30',
  textPrimary: '#F0E6D3',
  textSecondary: '#9A9590',
  textTertiary: '#8A8680',
  textMuted: '#6A6560',
  textDisabled: '#4A4440',
  accent: '#E8893C',
  border: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(232,137,60,0.15)',
  divider: 'rgba(255,255,255,0.05)',
} as const;

export const lightColors = {
  base: '#FAF6F0',
  surface: '#FFFFFF',
  surfaceRecessed: '#F0E8DC',
  surfaceAccent: '#FFF8F0',
  textPrimary: '#2A2218',
  textSecondary: '#6A5D50',
  textTertiary: '#706862',
  textMuted: '#7A6E60',
  textDisabled: '#B0A89E',
  accent: '#C06A20',
  border: 'rgba(0,0,0,0.06)',
  borderAccent: 'rgba(192,106,32,0.15)',
  divider: 'rgba(0,0,0,0.05)',
} as const;

export const deityColors: Record<string, string> = {
  Ganesh: '#E8893C',
  Shiva: '#7AA8C8',
  Lakshmi: '#D4A853',
  Vishnu: '#5DCAA5',
  Hanuman: '#E85D3A',
  Krishna: '#4A7ABF',
  Rama: '#5EA06A',
  Durga: '#D45454',
  Saraswati: '#B0A0D8',
  Parvati: '#E07878',
  Kali: '#8B5CF6',
  Surya: '#F0A030',
  Kartikeya: '#E06040',
  Brahma: '#D4A060',
  'Sai Baba': '#A0886A',
  Jagannath: '#3A8FD4',
  'Santoshi Mata': '#E8A060',
  Radha: '#E888A0',
  Sita: '#D4876E',
  Venkateswara: '#E8C840',
  'Khatu Shyam': '#4A90D9',
  Ayyappa: '#2E8B57',
  'Vaishno Devi': '#E05070',
  Narasimha: '#D4A030',
  Dattatreya: '#7B68EE',
  Ganga: '#40B5C4',
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

// ─── Font Config ─────────────────────────────────────────────────────────────

const fontConfig = {
  displayLarge:   { fontFamily: 'Mukta_500Medium' },
  displayMedium:  { fontFamily: 'Mukta_500Medium' },
  displaySmall:   { fontFamily: 'Mukta_500Medium' },
  headlineLarge:  { fontFamily: 'Mukta_500Medium' },
  headlineMedium: { fontFamily: 'Mukta_500Medium' },
  headlineSmall:  { fontFamily: 'Mukta_500Medium' },
  titleLarge:     { fontFamily: 'Mukta_500Medium' },
  titleMedium:    { fontFamily: 'Mukta_500Medium' },
  titleSmall:     { fontFamily: 'Mukta_500Medium' },
  bodyLarge:      { fontFamily: 'Mukta_400Regular' },
  bodyMedium:     { fontFamily: 'Mukta_400Regular' },
  bodySmall:      { fontFamily: 'Mukta_400Regular' },
  labelLarge:     { fontFamily: 'Mukta_400Regular' },
  labelMedium:    { fontFamily: 'Mukta_400Regular' },
  labelSmall:     { fontFamily: 'Mukta_400Regular' },
};

const fonts = configureFonts({ config: fontConfig });

// ─── MD3 Themes ──────────────────────────────────────────────────────────────

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.accent,
    background: darkColors.base,
    surface: darkColors.surface,
    onSurface: darkColors.textPrimary,
    onBackground: darkColors.textPrimary,
    surfaceVariant: darkColors.surfaceRecessed,
    onSurfaceVariant: darkColors.textSecondary,
    outline: darkColors.border,
    error: semanticColors.error,
    onError: '#FFFFFF',
  },
  fonts,
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightColors.accent,
    background: lightColors.base,
    surface: lightColors.surface,
    onSurface: lightColors.textPrimary,
    onBackground: lightColors.textPrimary,
    surfaceVariant: lightColors.surfaceRecessed,
    onSurfaceVariant: lightColors.textSecondary,
    outline: lightColors.border,
    error: semanticColors.error,
    onError: '#FFFFFF',
  },
  fonts,
};
