export interface IAarti {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string[]; // Array of verse strings
  deity: string; // "Ganesh" | "Shiva" | "Lakshmi" | "Vishnu" | "Hanuman"
}

export interface IChalisaSection {
  type: 'doha' | 'chaupai'; // Doha = couplet, Chaupai = quatrain
  label: string; // "दोहा" or "चौपाई"
  verses: string[]; // Array of verse strings
}

export interface IChalisa {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string; // "Hanuman" | "Shiva" | "Ganesh" etc.
  sections: IChalisaSection[]; // Ordered: opening doha → chaupais → closing doha
}

/** Western tropical zodiac signs — used for daily Rashifal. Stored as lowercase keys in DB. */
export type RashiSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export const ALL_RASHI_SIGNS: RashiSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export interface IRashifal {
  date: string; // YYYY-MM-DD
  sign: RashiSign;
  language: string; // 'en' | 'hi'
  body: string;
}

export type VratType =
  | 'ekadashi'
  | 'pradosha'
  | 'purnima'
  | 'amavasya'
  | 'sankashti'
  | 'shivaratri'
  | 'karwa_chauth'
  | 'janmashtami'
  | 'navratri'
  | 'satyanarayan'
  | 'vat_savitri';

export interface IKatha {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  summary: string; // Short summary in Hindi
  paragraphs: string[]; // Narrative paragraphs in Hindi
  vratType?: VratType | null; // Associates this katha with a recurring vrat/festival
}

/** Timed slot with quality rating (used by Choghadiya and Gowri Panchangam). */
export interface IQualitySlot {
  name: string;
  quality: 'auspicious' | 'inauspicious' | 'neutral';
  /** Localized display name for the quality (e.g. "शुभ" in Hindi). */
  qualityName: string;
  start: string;
  end: string;
}

/** @deprecated Use IQualitySlot instead. Kept as alias for backwards compat. */
export type IChoghadiyaSlot = IQualitySlot;

/** Planetary hour slot. */
export interface IHoraSlot {
  planet: string;
  start: string;
  end: string;
}

/** A special yoga active on the day (e.g. Amrit Siddhi, Sarvartha Siddhi). */
export interface ISpecialYoga {
  name: string;
  type: string;
}

/** A festival or observance for the day. */
export interface IFestival {
  name: string;
}

/** Sidereal position of a graha. */
export interface IGrahaPosition {
  planet: string;
  rashi: string;
  degreeInRashi: number;
  nakshatra: string;
  nakshatraPada: number;
  isRetrograde: boolean;
}

/** One panchang element (tithi/nakshatra/yoga/karana) active during the day. */
export interface IPanchangElement {
  name: string;
  /** Formatted end time, e.g. "1:50 PM". Undefined = extends past midnight. */
  endTime?: string;
  /**
   * Raw epoch ms of the end time (same reference frame as Date.now()).
   * Undefined when end-times were not computed (computeEndTimes: false).
   * Use this to find which element is active right now.
   */
  endTimeMs?: number;
}

/** Full panchang for a sunrise-to-sunrise day. Elements are arrays because
 *  tithi/nakshatra/yoga/karana can change mid-day (e.g. 2 tithis in one day). */
export interface IPanchangDay {
  date: Date;
  tithis: IPanchangElement[];
  nakshatras: IPanchangElement[];
  yogas: IPanchangElement[];
  karanas: IPanchangElement[];
  sunrise: string;
  sunset: string;
  rahuKalamStart?: string;
  rahuKalamEnd?: string;
  yamagandaStart?: string;
  yamagandaEnd?: string;
  gulikaKalamStart?: string;
  gulikaKalamEnd?: string;
  abhijitMuhurtaStart?: string;
  abhijitMuhurtaEnd?: string;
  durMuhurta: Array<{ start: string; end: string }>;
  vara?: string;
  hinduMonth?: string;
  hinduMonthAmanta?: string;
  hinduMonthPurnimanta?: string;
  masa?: string;
  vikramSamvat: number;
  shakaSamvat: number;
  chandraRashi?: string;
  suryaNakshatra?: string;
  moonrise?: string;
  moonset?: string;
  brahmaMuhurtaStart?: string;
  brahmaMuhurtaEnd?: string;
  panchaka: boolean;
  dayDurationMinutes: number;
  nightDurationMinutes: number;
  choghadiya: { day: IQualitySlot[]; night: IQualitySlot[] };
  gowriPanchangam: { day: IQualitySlot[]; night: IQualitySlot[] };
  hora: { day: IHoraSlot[]; night: IHoraSlot[] };
  specialYogas: ISpecialYoga[];
  festivals: IFestival[];
  planetaryPositions?: IGrahaPosition[];
}
