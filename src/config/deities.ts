import type { Deity } from 'hindu-devotional-texts';

import { deityColors } from './theme';

/**
 * Structural deity metadata: the roster slug, the script-agnostic names used
 * for search/avatars, and the app's colour token. Localised display strings
 * (honorific `displayName`, one-line `description`) are NOT here — they live in
 * i18n (`deities.<id>.*` in the locale bundles) and render via `t()`, which is
 * the single source of truth for user-facing labels in both languages.
 */
export interface DeityMeta {
  id: Deity;         // Slug — matches `Deity` from hindu-devotional-texts (e.g. "ganesha")
  name: string;      // English name, also the search key (e.g. "Ganesha")
  nameHindi: string; // Devanagari name (search key)
  initial: string;   // Devanagari initial for DeityAvatar fallback
  color: string;     // From deityColors (app design token — stays app-side)
}

export const ALL_DEITIES: DeityMeta[] = [
  { id: 'ganesha',       name: 'Ganesha',       nameHindi: 'गणेश',       initial: 'ग',  color: deityColors.ganesha },
  { id: 'shiva',         name: 'Shiva',         nameHindi: 'शिव',        initial: 'श',  color: deityColors.shiva },
  { id: 'vishnu',        name: 'Vishnu',        nameHindi: 'विष्णु',     initial: 'वि', color: deityColors.vishnu },
  { id: 'hanuman',       name: 'Hanuman',       nameHindi: 'हनुमान',     initial: 'ह',  color: deityColors.hanuman },
  { id: 'lakshmi',       name: 'Lakshmi',       nameHindi: 'लक्ष्मी',    initial: 'ल',  color: deityColors.lakshmi },
  { id: 'krishna',       name: 'Krishna',       nameHindi: 'कृष्ण',      initial: 'कृ', color: deityColors.krishna },
  { id: 'rama',          name: 'Rama',          nameHindi: 'राम',        initial: 'रा', color: deityColors.rama },
  { id: 'durga',         name: 'Durga',         nameHindi: 'दुर्गा',     initial: 'दु', color: deityColors.durga },
  { id: 'saraswati',     name: 'Saraswati',     nameHindi: 'सरस्वती',    initial: 'स',  color: deityColors.saraswati },
  { id: 'parvati',       name: 'Parvati',       nameHindi: 'पार्वती',    initial: 'पा', color: deityColors.parvati },
  { id: 'kali',          name: 'Kali',          nameHindi: 'काली',       initial: 'का', color: deityColors.kali },
  { id: 'surya',         name: 'Surya',         nameHindi: 'सूर्य',      initial: 'सू', color: deityColors.surya },
  { id: 'brahma',        name: 'Brahma',        nameHindi: 'ब्रह्मा',    initial: 'ब्र', color: deityColors.brahma },
  { id: 'sai-baba',      name: 'Sai Baba',      nameHindi: 'साईं बाबा',  initial: 'सा', color: deityColors['sai-baba'] },
  { id: 'santoshi-mata', name: 'Santoshi Mata', nameHindi: 'संतोषी माता', initial: 'सं', color: deityColors['santoshi-mata'] },
  { id: 'sita',          name: 'Sita',          nameHindi: 'सीता',       initial: 'सी', color: deityColors.sita },
  { id: 'khatu-shyam',   name: 'Khatu Shyam',   nameHindi: 'खाटू श्याम', initial: 'खा', color: deityColors['khatu-shyam'] },
  { id: 'vaishno-devi',  name: 'Vaishno Devi',  nameHindi: 'वैष्णो देवी', initial: 'वै', color: deityColors['vaishno-devi'] },
  { id: 'narasimha',     name: 'Narasimha',     nameHindi: 'नरसिंह',     initial: 'नर', color: deityColors.narasimha },
];

export const DEITY_BY_ID = Object.fromEntries(ALL_DEITIES.map(d => [d.id, d])) as Record<string, DeityMeta>;
