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

// ─── Font Config ─────────────────────────────────────────────────────────────

export const fonts = {
  heading: 'Mukta_500Medium',
  body: 'Mukta_400Regular',
  bold: 'Mukta_700Bold',
} as const;
