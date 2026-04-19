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

/** Festival type — mirrors panchang-ts v2 FestivalInfo.type. */
export type FestivalType =
  | 'major'
  | 'minor'
  | 'ekadashi'
  | 'smarta_ekadashi'
  | 'vaishnava_ekadashi'
  | 'pradosha'
  | 'sankranti'
  | 'eclipse';

/** A festival or observance for the day. */
export interface IFestival {
  name: string;
  type: FestivalType;
  /** Classical/specific name, e.g. "Saphala Ekadashi" for a generic Ekadashi. */
  description?: string;
  /** Smarta-only: when Ekadashi is Dashami-viddha, the Dwadashi fast day (ISO yyyy-mm-dd). */
  deferralDate?: string;
}

/** Solar or lunar eclipse overlapping the Hindu day. */
export interface IEclipse {
  kind: 'solar' | 'lunar';
  subtype: 'partial' | 'total' | 'annular' | 'penumbral';
  /** Formatted "h:mm AM/PM" times. */
  peak: string;
  start: string;
  end: string;
  sutakStart: string;
  sutakEnd: string;
  visibleFromLocation: boolean;
  magnitude: number;
  description: string;
}

/** Bhadra Kala (Vishti Karana) window overlapping the Hindu day. */
export interface IBhadra {
  start: string;
  end: string;
  /** 'earth' is malefic for all work; 'heaven'/'paatal' are milder. */
  location: 'earth' | 'heaven' | 'paatal';
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
  vijayaMuhurtaStart?: string;
  vijayaMuhurtaEnd?: string;
  godhuliMuhurtaStart?: string;
  godhuliMuhurtaEnd?: string;
  nishitaMuhurtaStart?: string;
  nishitaMuhurtaEnd?: string;
  amritKalaStart?: string;
  amritKalaEnd?: string;
  bhadra?: IBhadra | null;
  eclipse?: IEclipse | null;
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
