import { create } from 'zustand';

/**
 * Shareable-card request (P14.5). A screen calls `open(spec)`; the singleton
 * `<ShareCardHost />` mounted in `app/_layout.tsx` renders the matching card
 * off-screen, captures it to a 1080-px PNG, and presents the share / save sheet.
 *
 * Every card is app-watermarked and (where it carries scripture/mantra text)
 * source-labelled — see `resolveShareContent` in `src/components/share/content.ts`.
 */
export type ShareCardSpec =
  /** Festival greeting — deity image (if mapped) + festival name (Devanagari + English). */
  | {
      kind: 'festival-greeting';
      festivalNameEn: string;
      festivalNameHi: string;
      /** Deity slug used to pick a portrait + accent colour; falls back to a yantra mark. */
      deityId?: string;
      /** Optional date line, already localized (e.g. "12 May 2026"). */
      dateLabel?: string;
    }
  /** Deity blessing — portrait + display name + one signature line. */
  | {
      kind: 'deity-blessing';
      deityId: string;
      /** Optional one-line mantra / invocation in Devanagari shown under the name. */
      mantraHi?: string;
    }
  /** Verse / chaupai / doha card from the aarti or chalisa reader. */
  | {
      kind: 'verse';
      deityId: string;
      verseHi: string;
      verseEn?: string;
      /** Attribution, already localized — e.g. "From Hanuman Chalisa". */
      sourceLabel: string;
    }
  /** Post-session "I completed N repetitions of <mantra> today" card. */
  | {
      kind: 'jaap-completion';
      count: number;
      mantraHi: string;
      mantraTranslit?: string;
      mantraTitleEn: string;
      deityId?: string;
    }
  /** Sadhana milestone unlocked (P14.4) — the sacred number itself is the focal
   *  glyph. `kind` selects the headline phrasing ("repetitions" vs "day sadhana"
   *  vs "sessions"); the resolver picks the gold-on-ink accent and an optional
   *  deity portrait if one was tied to the session that crossed the threshold. */
  | {
      kind: 'milestone';
      milestoneKind: 'sessions' | 'repetitions' | 'streak';
      threshold: number;
      deityId?: string;
    };

interface ShareSheetState {
  spec: ShareCardSpec | null;
  open: (spec: ShareCardSpec) => void;
  close: () => void;
}

export const useShareSheet = create<ShareSheetState>((set) => ({
  spec: null,
  open: (spec) => set({ spec }),
  close: () => set({ spec: null }),
}));
