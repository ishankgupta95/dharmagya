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

// Mapped from raw Panchangam response (numeric indices → display strings)
export interface IPanchangDay {
  date: Date;
  tithi: string; // Resolved from tithiNames[panchangam.tithi]
  nakshatra: string; // Resolved from nakshatraNames[panchangam.nakshatra]
  yoga: string; // Resolved from yogaNames[panchangam.yoga]
  karana: string; // Already a string from library
  sunrise: string; // Formatted from panchangam.sunrise Date
  sunset: string; // Formatted from panchangam.sunset Date
  tithiEndTime?: string; // Formatted end time
  nakshatraEndTime?: string; // Formatted end time
  yogaEndTime?: string; // Formatted end time
  rahuKalamStart?: string; // Formatted
  rahuKalamEnd?: string; // Formatted
  vara?: string; // Day of week (e.g., "Monday")
  hinduMonth?: string; // Hindu month name (e.g., "Phalguna")
  vikramSamvat?: number; // Vikram Samvat year (e.g., 2082)
}
