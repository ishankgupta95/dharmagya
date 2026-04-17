import { getSiderealMoonLongitude } from 'panchang-ts';

import type { RashiSign } from '@/types';

// Tropical zodiac boundaries (month, day). Simple and matches Western expectations
// — the authentic Jyotish Moon-sign (Janma Rashi) requires birth-time nakshatra
// calculation which we defer to the Kundli feature in Phase 4.
interface SignBounds {
  sign: RashiSign;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

const BOUNDS: SignBounds[] = [
  { sign: 'capricorn',   startMonth: 12, startDay: 22, endMonth: 1,  endDay: 19 },
  { sign: 'aquarius',    startMonth: 1,  startDay: 20, endMonth: 2,  endDay: 18 },
  { sign: 'pisces',      startMonth: 2,  startDay: 19, endMonth: 3,  endDay: 20 },
  { sign: 'aries',       startMonth: 3,  startDay: 21, endMonth: 4,  endDay: 19 },
  { sign: 'taurus',      startMonth: 4,  startDay: 20, endMonth: 5,  endDay: 20 },
  { sign: 'gemini',      startMonth: 5,  startDay: 21, endMonth: 6,  endDay: 20 },
  { sign: 'cancer',      startMonth: 6,  startDay: 21, endMonth: 7,  endDay: 22 },
  { sign: 'leo',         startMonth: 7,  startDay: 23, endMonth: 8,  endDay: 22 },
  { sign: 'virgo',       startMonth: 8,  startDay: 23, endMonth: 9,  endDay: 22 },
  { sign: 'libra',       startMonth: 9,  startDay: 23, endMonth: 10, endDay: 22 },
  { sign: 'scorpio',     startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { sign: 'sagittarius', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
];

/**
 * Moon's sidereal rashi index at noon UTC on `date` (0=Mesha … 11=Meena).
 *
 * Used to approximate Janma Rashi from a birth date without time. Moon travels
 * ~12–13°/day (≈ half a rashi), so this is accurate within one rashi; births
 * near a sign boundary may land in the neighbouring rashi. Good enough for
 * Chandra Balam; not good enough for birth-chart calculations.
 */
export function moonRashiIndexAtNoon(date: Date): number {
  const noon = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0
  ));
  const lon = getSiderealMoonLongitude(noon, 'lahiri');
  const normalized = ((lon % 360) + 360) % 360;
  return Math.floor(normalized / 30);
}

/** Derive zodiac sign from a birth date. Month is 1-indexed. */
export function signFromBirthDate(birthDate: Date): RashiSign {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  for (const b of BOUNDS) {
    if (b.startMonth === b.endMonth) {
      if (month === b.startMonth && day >= b.startDay && day <= b.endDay) return b.sign;
    } else {
      // Spans a month boundary (e.g. Capricorn Dec 22 → Jan 19)
      if ((month === b.startMonth && day >= b.startDay) || (month === b.endMonth && day <= b.endDay)) {
        return b.sign;
      }
    }
  }
  return 'aries'; // should never hit — bounds cover all dates
}
