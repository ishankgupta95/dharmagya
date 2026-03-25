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
  vara?: string;
  hinduMonth?: string;
  vikramSamvat?: number;
}
