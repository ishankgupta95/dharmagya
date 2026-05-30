import type { ImageSourcePropType } from 'react-native';

import type { ShareCardSpec } from '@/store/useShareSheet';
import { DEITY_BY_ID } from '@/config/deities';
import { getDeityImage } from '@/config/deityImages';
import { getFestivalDeity } from '@/config/festivalDeity';
import { palette } from '@/config/theme';

/**
 * Localized, render-ready content for a shareable card (P14.5). Resolved once
 * by `<ShareCardHost />`; `<ShareCard />` is a pure function of this. Both the
 * Devanagari and English faces are always populated — the card is bilingual
 * regardless of the app's UI language — and `source` carries the attribution
 * line for scripture/mantra cards (classical / public-domain text, one or two
 * lines only).
 */
export interface ShareCardContent {
  /** Deity portrait to bleed behind the card, or null → yantra-mark fallback. */
  image: ImageSourcePropType | null;
  /** Accent colour for ornament strokes / fallback gradient (deity colour or sindoor). */
  accent: string;
  /** Devanagari initial for the no-image fallback. */
  initial: string;
  /** Small mono-caps eyebrow above the headline. */
  kicker: string;
  /** Optional badge shown at the top (date for festivals, count for jaap). */
  topBadge?: string;
  /** Focal Devanagari line(s). */
  focalHi: string;
  /** Focal English / transliteration line under it. */
  focalEn?: string;
  /** Optional secondary Devanagari line (signature mantra under a deity name). */
  subHi?: string;
  /** Optional secondary English / transliteration line. */
  subEn?: string;
  /** Attribution line for scripture/mantra cards — e.g. "From Hanuman Chalisa". */
  source?: string;
  /** True for the verse card layout (focal text is the verse, deity name demoted). */
  verseLayout: boolean;
}

/** Localized strings the host pulls from i18n and hands to the resolver. */
export interface ShareStrings {
  kickerDeityBlessing: string;
  kickerFestival: string;
  kickerVerse: string;
  kickerJaap: string;
  /** "{{count}} repetitions" — pass an i18n-formatted count. */
  jaapCountLine: (count: number) => string;
  /** Milestone kicker — e.g. "SADHANA MILESTONE". */
  kickerMilestone: string;
  /**
   * Sub-line beneath the milestone numeral, e.g. "sacred repetitions",
   * "day sadhana", "completed sessions". Localised per kind.
   */
  milestoneSubline: (kind: 'sessions' | 'repetitions' | 'streak') => string;
  /** Headline numeral itself — already formatted with locale digits / grouping. */
  milestoneFigure: (threshold: number) => string;
  /**
   * Honorific Hindi display name for a deity (e.g. "श्री गणेश जी"), resolved
   * from i18n by the host. The deity card's Devanagari focal line — kept out
   * of the deity config so i18n stays the single source for display strings.
   */
  deityDisplayHi: (deityId: string) => string;
}

export function resolveShareContent(spec: ShareCardSpec, s: ShareStrings): ShareCardContent {
  switch (spec.kind) {
    case 'deity-blessing': {
      const meta = DEITY_BY_ID[spec.deityId];
      return {
        image: getDeityImage(spec.deityId),
        accent: meta?.color ?? palette.sindoor,
        initial: meta?.initial ?? 'ॐ',
        kicker: s.kickerDeityBlessing,
        focalHi: s.deityDisplayHi(spec.deityId),
        focalEn: meta?.name,
        subHi: spec.mantraHi,
        verseLayout: false,
      };
    }
    case 'festival-greeting': {
      const deityId = spec.deityId ?? getFestivalDeity(spec.festivalNameEn) ?? undefined;
      const meta = deityId ? DEITY_BY_ID[deityId] : undefined;
      return {
        image: deityId ? getDeityImage(deityId) : null,
        accent: meta?.color ?? palette.sindoor,
        initial: meta?.initial ?? 'ॐ',
        kicker: s.kickerFestival,
        topBadge: spec.dateLabel,
        focalHi: spec.festivalNameHi || spec.festivalNameEn,
        focalEn: spec.festivalNameEn,
        verseLayout: false,
      };
    }
    case 'verse': {
      const meta = DEITY_BY_ID[spec.deityId];
      return {
        image: getDeityImage(spec.deityId),
        accent: meta?.color ?? palette.sindoor,
        initial: meta?.initial ?? 'ॐ',
        kicker: s.kickerVerse,
        focalHi: spec.verseHi,
        focalEn: spec.verseEn,
        source: spec.sourceLabel,
        verseLayout: true,
      };
    }
    case 'jaap-completion': {
      const meta = spec.deityId ? DEITY_BY_ID[spec.deityId] : undefined;
      return {
        image: spec.deityId ? getDeityImage(spec.deityId) : null,
        accent: meta?.color ?? palette.sindoor,
        initial: meta?.initial ?? 'ॐ',
        kicker: s.kickerJaap,
        topBadge: s.jaapCountLine(spec.count),
        focalHi: spec.mantraHi,
        focalEn: spec.mantraTranslit,
        subEn: spec.mantraTitleEn,
        verseLayout: false,
      };
    }
    case 'milestone': {
      // No deity image — the celebration is private, the focal block is the
      // numeral, and a portrait behind it muddies the read. Top-half halo
      // shows the sacred ॐ; bottom block carries the number + kind label.
      const meta = spec.deityId ? DEITY_BY_ID[spec.deityId] : undefined;
      return {
        image: null,
        accent: meta?.color ?? palette.goldLeaf,
        initial: 'ॐ',
        kicker: s.kickerMilestone,
        focalHi: s.milestoneFigure(spec.threshold),
        focalEn: s.milestoneSubline(spec.milestoneKind),
        verseLayout: false,
      };
    }
  }
}
