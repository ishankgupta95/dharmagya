import {
  GRAHA_ABBR,
  type BirthChart,
  type DivisionalChart,
  type GrahaName,
  type Language,
  type PlanetPlacement,
} from 'panchang-ts';

/** One cell of a kundli chart — what goes inside one of the 12 boxes. */
export interface ChartCell {
  /** Rashi 0..11 (0 = Mesha … 11 = Meena). */
  rashi: number;
  /** House 1..12 from the chart's lagna. */
  house: number;
  /** Localized rashi short label (e.g. "Mesha" or "मेष"). */
  rashiName: string;
  /** Graha abbreviations occupying this rashi (e.g. "Su", "Mo", "Ma(R)"). */
  planets: string[];
  /** True for the lagna's own rashi (display "Asc" / lagna marker). */
  isLagna: boolean;
}

const RASHI_SHORT: Record<Language, string[]> = {
  en: [
    'Me', 'Vr', 'Mi', 'Ka', 'Si', 'Kn',
    'Tu', 'Vc', 'Dh', 'Mk', 'Km', 'Mn',
  ],
  hi: [
    'मे', 'वृ', 'मि', 'क', 'सिं', 'कन्',
    'तु', 'वृश्', 'धनु', 'मक', 'कुं', 'मीन',
  ],
};

/** GRAHA_ABBR ordered to match planet placement; suffix '(R)' if retrograde. */
function fmtGraha(p: { planet: GrahaName; isRetrograde: boolean }): string {
  const abbr = GRAHA_ABBR[p.planet];
  return p.isRetrograde && p.planet !== 'Sun' && p.planet !== 'Moon' ? `${abbr}(R)` : abbr;
}

/** Build the 12 cells (in rashi order, 0..11) for a D1 birth chart. */
export function cellsFromD1(chart: BirthChart, lang: Language): ChartCell[] {
  const lagnaRashi = chart.lagna.rashi.index;
  const labels = RASHI_SHORT[lang] ?? RASHI_SHORT.en;
  return Array.from({ length: 12 }, (_, rashi) => {
    const planetsHere = chart.planets
      .filter((p) => p.rashi.index === rashi)
      .map(fmtGraha);
    return {
      rashi,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      rashiName: labels[rashi],
      planets: planetsHere,
      isLagna: rashi === lagnaRashi,
    };
  });
}

/** Build the 12 cells for a D9 divisional chart (whole-sign by classical rule). */
export function cellsFromD9(chart: DivisionalChart, lang: Language): ChartCell[] {
  const lagnaRashi = chart.lagnaRashi.index;
  const labels = RASHI_SHORT[lang] ?? RASHI_SHORT.en;
  return Array.from({ length: 12 }, (_, rashi) => {
    const planetsHere = chart.planets
      .filter((p) => p.rashi.index === rashi)
      .map(fmtGraha);
    return {
      rashi,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      rashiName: labels[rashi],
      planets: planetsHere,
      isLagna: rashi === lagnaRashi,
    };
  });
}

/** Build the 12 cells for any chart whose shape is `{ lagnaRashi, planets[] }`
 *  — used by Varshaphala / Tithi Pravesha which return a flat planets array
 *  + an explicit lagna instead of a `BirthChart` / `DivisionalChart` wrapper. */
export function cellsFromLagnaPlanets(
  lagnaRashi: number,
  planets: PlanetPlacement[],
  lang: Language,
): ChartCell[] {
  const labels = RASHI_SHORT[lang] ?? RASHI_SHORT.en;
  return Array.from({ length: 12 }, (_, rashi) => {
    const planetsHere = planets
      .filter((p) => p.rashi.index === rashi)
      .map(fmtGraha);
    return {
      rashi,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      rashiName: labels[rashi],
      planets: planetsHere,
      isLagna: rashi === lagnaRashi,
    };
  });
}
