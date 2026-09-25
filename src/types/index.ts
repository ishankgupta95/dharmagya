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
  /** Localized ruling-graha name — Devanagari under the Hindi locale. */
  planet: string;
  /** 0-6 in Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars.
   *  Language-stable, so anything keyed on the graha (colour coding, icons)
   *  must key on this and not on `planet`. */
  planetIndex: number;
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
}

/** Lightweight summary of an upcoming eclipse — used for forecasting cards. */
export interface IEclipseSummary {
  kind: 'solar' | 'lunar';
  subtype: 'partial' | 'total' | 'annular' | 'penumbral';
  /** ISO yyyy-mm-dd of the local calendar date the eclipse peak falls on. */
  date: string;
  /** Formatted h:mm AM/PM in the local timezone. */
  peak: string;
  visibleFromLocation: boolean;
  description: string;
}

/** Snapshot of the panchang elements active at a single instant (vs sunrise-day). */
export interface IInstantPanchang {
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
}

/** Solar or lunar eclipse overlapping the Hindu day. */
export interface IEclipse {
  kind: 'solar' | 'lunar';
  subtype: 'partial' | 'total' | 'annular' | 'penumbral';
  /** Formatted "h:mm AM/PM" times. */
  peak: string;
  start: string;
  end: string;
  /**
   * Sutak (impurity) window, formatted like the others. Both instants are
   * `null` for a penumbral lunar eclipse, which carries no sutak at all — a
   * render site must skip the row rather than print an empty range.
   */
  sutakStart: string | null;
  sutakEnd: string | null;
  visibleFromLocation: boolean;
  /**
   * Whether the PEAK itself is above the horizon — the engine's own narrow
   * test, where `visibleFromLocation` asks about any phase. Since panchang-ts
   * 5.4 a solar eclipse whose peak is below the horizon takes its `subtype`
   * from the deepest phase that IS seen, while `obscuration` stays the peak's,
   * so the two only describe the same moment when this is true.
   */
  peakVisible: boolean;
  /**
   * Fraction of the disc's *area* covered at peak, [0, 1] — render as a
   * percentage. Published by panchang-ts as `magnitude` through 4.x and
   * renamed in v5, where `magnitude` became the disc-*diameter* fraction that
   * eclipse catalogues publish (>1 when total, negative when penumbral).
   *
   * It is the *umbral* area, so a penumbral lunar eclipse legitimately reads
   * exactly 0 — that is "no umbral coverage", not a failed computation.
   */
  obscuration: number;
  description: string;
}

/** Bhadra Kala (Vishti Karana) window overlapping the Hindu day. */
export interface IBhadra {
  start: string;
  end: string;
  /** 'earth' is malefic for all work; 'heaven'/'paatal' are milder. */
  location: 'earth' | 'heaven' | 'paatal';
}

/** Ganda Mula — Moon in one of the 6 root nakshatras at sunrise. */
export interface IGandaMula {
  nakshatraName: string;
  /** Mula/Jyeshtha = severe; Ashwini/Ashlesha/Magha/Revati = mild. */
  severity: 'mild' | 'severe';
}

/** Anandadi Yoga — Vara × Nakshatra 28-name cycle yoga at sunrise. */
export interface IAnandadiYoga {
  name: string;
  quality: 'auspicious' | 'inauspicious' | 'neutral';
}

/** Tarabala — 9-tara cycle position relative to native's janma nakshatra. */
export interface ITarabala {
  /** Locale-specific name (Janma/Sampat/Vipat/…). */
  name: string;
  /** Sanskrit transliteration; stable across locales for keying styles. */
  englishName: string;
  quality: 'auspicious' | 'inauspicious';
}

/** Chandra Balam — transit-Moon strength relative to native's janma rashi. */
export interface IChandraBalam {
  /** 1 = janma rashi itself; 2 = next rashi; … 12 = rashi prior to janma. */
  house: number;
  quality: 'strong' | 'weak';
  /** Sanskrit transliteration ('Shubha' | 'Ashubha'). */
  englishName: string;
  /** Locale-specific name. */
  name: string;
}

/** Sidereal position of a graha. */
export interface IGrahaPosition {
  /** Localized display name. */
  planet: string;
  /** Canonical English name (stable key for icon / abbreviation lookup). */
  planetEn: 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';
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
  /** Tithi-only: lunar fortnight. Null for Purnima/Amavasya boundary entries. */
  paksha?: 'Shukla' | 'Krishna' | null;
  /** Tithi-only: tithi number 1–15. */
  tithiNumber?: number;
  /** Nakshatra-only: pada (quarter) 1–4. */
  pada?: number;
  /** Karana-only: 4 fixed (Shakuni/Naga/Chatushpada/Kintughna) vs 7 movable. */
  karanaType?: 'fixed' | 'movable';
  /** Fraction (0–1) of this element's natural span elapsed at sunrise. */
  completionPercentage?: number;
  /** Formatted start time. Undefined = element began before previous sunrise. */
  startTime?: string;
  /** True for the entry that's active at the day's sunrise (the muhurta-correct one). */
  isActiveAtSunrise?: boolean;
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
  durMuhurta: { start: string; end: string }[];
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
  /** 0–2 nakshatra-anchored windows; transition days carry two. */
  amritKala: { start: string; end: string }[];
  madhyahnaStart?: string;
  madhyahnaEnd?: string;
  pratahSandhyaStart?: string;
  pratahSandhyaEnd?: string;
  sayahnaSandhyaStart?: string;
  sayahnaSandhyaEnd?: string;
  /** 0–2 nakshatra-anchored windows; transition days carry two. */
  varjyam: { start: string; end: string }[];
  gandaMula?: IGandaMula | null;
  anandadiYoga?: IAnandadiYoga;
  tarabala?: ITarabala | null;
  chandraBalam?: IChandraBalam | null;
  bhadra?: IBhadra | null;
  /** Sunrise of the day after this Hindu day (used to flank the panchang day). */
  nextSunrise?: string;
  /** Lahiri/Raman/KP ayanamsa value used for this calculation, in degrees. */
  ayanamsa?: number;
  /** True on Adhika Masa (leap-month) days — Purushottam Maas. */
  isAdhikaMasa: boolean;
  eclipse?: IEclipse | null;
  panchaka: boolean;
  /** Slices of the Hindu day FREE of Panchaka. Used to show a relief
   *  window on Panchaka-transition days. */
  panchakaRahita: { start: string; end: string }[];
  dayDurationMinutes: number;
  nightDurationMinutes: number;
  choghadiya: { day: IQualitySlot[]; night: IQualitySlot[] };
  gowriPanchangam: { day: IQualitySlot[]; night: IQualitySlot[] };
  doGhatiMuhurta: { day: IQualitySlot[]; night: IQualitySlot[] };
  hora: { day: IHoraSlot[]; night: IHoraSlot[] };
  specialYogas: ISpecialYoga[];
  festivals: IFestival[];
  planetaryPositions?: IGrahaPosition[];
}
