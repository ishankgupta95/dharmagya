/**
 * Tirtha (sacred geography) — re-export boundary over `hindu-devotional-texts`
 * (v0.7.0+). The lib ships 112 pilgrimage sites across six canonical lists
 * (12 Jyotirlingas, 78 Shakti Peethas, 4 Char Dham, 4 Chota Char Dham, 7 Sapta
 * Puri, 7 sacred rivers) plus three reference ślokas. This file adds the
 * app-side category metadata (icon, ordering, attached śloka) the atlas screens
 * render, and sanitizes the prose at the boundary (per
 * `feedback_no_source_attribution_in_ui`). Screens import from here, never the
 * package directly.
 */
import {
  getAllTirthas as pkgGetAllTirthas,
  TIRTHA_SOURCES,
  DVADASHA_JYOTIRLINGA_STOTRA,
  SAPTA_PURI_SLOKA,
  SAPTA_NADI_SLOKA,
  type TirthaCategory,
  type TirthaEntry,
  type TirthaSloka,
} from 'hindu-devotional-texts';

import type { IconName } from '@/components/common/Icon';
import { sanitizeBilingual } from '@/utils/sanitizeContent';

export type { TirthaCategory, TirthaEntry, TirthaSloka };
export { TIRTHA_SOURCES };

function sanitizeTirtha(t: TirthaEntry): TirthaEntry {
  return { ...t, significance: sanitizeBilingual(t.significance) };
}

/** All sites, sanitized, in registry order. */
const ALL_TIRTHAS: readonly TirthaEntry[] = pkgGetAllTirthas().map(sanitizeTirtha);

export interface TirthaCategoryMeta {
  key: TirthaCategory;
  icon: IconName;
  /** i18n key for the category display name (`tirtha.category.*`). */
  i18nKey: string;
  /** A reference śloka shown atop the category list, where the tradition has
   *  a canonical one (the Dvādaśa-Jyotirliṅga stotra, Sapta-Purī / Sapta-Nadī
   *  ślokas). */
  sloka?: TirthaSloka;
}

/** The six lists, in display order (best-known first). */
export const TIRTHA_CATEGORIES: readonly TirthaCategoryMeta[] = [
  { key: 'jyotirlinga', icon: 'flame', i18nKey: 'tirtha.category.jyotirlinga', sloka: DVADASHA_JYOTIRLINGA_STOTRA },
  { key: 'char-dham', icon: 'compass', i18nKey: 'tirtha.category.char-dham' },
  { key: 'chota-char-dham', icon: 'navigate', i18nKey: 'tirtha.category.chota-char-dham' },
  { key: 'shakti-peetha', icon: 'flower', i18nKey: 'tirtha.category.shakti-peetha' },
  { key: 'sapta-puri', icon: 'home', i18nKey: 'tirtha.category.sapta-puri', sloka: SAPTA_PURI_SLOKA },
  { key: 'sacred-river', icon: 'globe', i18nKey: 'tirtha.category.sacred-river', sloka: SAPTA_NADI_SLOKA },
];

export function getTirthaCategoryMeta(key: string | undefined): TirthaCategoryMeta | undefined {
  return TIRTHA_CATEGORIES.find((c) => c.key === key);
}

/** Sites in a category, in registry order (jyotirlingas keep their 1..12 stotra order). */
export function getTirthasByCategory(key: string): TirthaEntry[] {
  return ALL_TIRTHAS.filter((t) => t.category === key);
}

export function getTirthaById(id: string | undefined): TirthaEntry | undefined {
  if (!id) return undefined;
  return ALL_TIRTHAS.find((t) => t.id === id);
}

/** Count per category, for the hub subtitles. */
export function tirthaCount(key: string): number {
  return ALL_TIRTHAS.reduce((n, t) => (t.category === key ? n + 1 : n), 0);
}
