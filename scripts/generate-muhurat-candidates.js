/**
 * Pre-compute "auspicious anywhere in India" candidate dates for each muhurat
 * occasion and write them to src/data/static/muhurat-candidates.json.
 *
 * Why this exists: the muhurat rule reads tithi / nakshatra / yoga at LOCAL
 * sunrise, so a fully precomputed list at one city would be wrong for users
 * elsewhere (sunrise drifts ~30–40 min east-to-west across India). This file
 * is therefore a *candidate* list — dates that satisfy the rule at any of
 * 5 reference longitudes spanning India. The runtime validates each
 * candidate at the user's actual coords, replacing the 365-day scan with
 * ~50 panchang calls. See plan: are-muhurats-calculated-on-greedy-quiche.md
 *
 * IMPORTANT: The RULES + evaluator below MUST MATCH
 * src/services/astrology/muhurat.ts. They are intentionally duplicated
 * because mixing CommonJS scripts with TS source modules requires either
 * tsx/ts-node or a JSON rules file — both are bigger lifts than keeping
 * 30 lines of stable classical rules in two places. If you change one,
 * change the other.
 *
 * Usage:  node scripts/generate-muhurat-candidates.js
 */

const { getDailyPanchang } = require('panchang-ts');
const fs = require('fs');
const path = require('path');

// ─── Lookahead window ────────────────────────────────────────────────────────
// 2 years from "today" gives the runtime an 18-month staleness gate plus a
// 6-month buffer for in-flight users between releases.
const LOOKAHEAD_DAYS = 365 * 2;

// ─── Reference longitudes ────────────────────────────────────────────────────
// 5 points bracketing India end-to-end. The east-west sweep is what matters;
// latitude barely shifts sunrise within India. Picking real cities (vs.
// abstract longitudes) keeps the values memorable.
const REFERENCES = [
  { name: 'Ahmedabad',  latitude: 23.0225, longitude: 72.5714 }, // ~72.6°E west
  { name: 'Pune',       latitude: 18.5204, longitude: 73.8567 }, // ~73.8°E
  { name: 'Bhopal',     latitude: 23.2599, longitude: 77.4126 }, // ~77.4°E central
  { name: 'Kolkata',    latitude: 22.5726, longitude: 88.3639 }, // ~88.4°E
  { name: 'Imphal',     latitude: 24.8170, longitude: 93.9368 }, // ~93.9°E far east
];
const TIMEZONE = 330; // IST = UTC+5:30 = 330 minutes

// ─── Rules — MUST MATCH src/services/astrology/muhurat.ts ────────────────────

const ALL_OCCASIONS = [
  'vivah',
  'griha-pravesh',
  'namkaran',
  'vahan',
  'mundan',
  'annaprashan',
  'vidyarambh',
];

const TITHI_COMMON = ['Pratipada', 'Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'];

const RULES = {
  vivah: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Magha', 'Uttara Phalguni', 'Hasta', 'Swati',
      'Anuradha', 'Mula', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati',
    ],
    excludedVaras: ['Tuesday'],
    excludedYogas: ['Vishkambha', 'Atiganda', 'Shula', 'Ganda', 'Vyaghata', 'Vajra', 'Vyatipata', 'Parigha', 'Vaidhriti'],
    requiresShuklaPaksha: true,
  },
  'griha-pravesh': {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Anuradha', 'Chitra', 'Uttara Phalguni',
      'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati', 'Dhanishta', 'Shatabhisha',
    ],
    excludedVaras: ['Tuesday', 'Saturday', 'Sunday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Vishkambha', 'Ganda', 'Shula', 'Parigha'],
    requiresShuklaPaksha: true,
  },
  namkaran: {
    auspiciousTithis: ['Pratipada', ...TITHI_COMMON, 'Dwadashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Punarvasu', 'Pushya', 'Hasta',
      'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha', 'Vajra'],
    requiresShuklaPaksha: false,
  },
  vahan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Shashthi', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Pushya', 'Punarvasu', 'Hasta',
      'Chitra', 'Uttara Phalguni', 'Uttara Ashadha', 'Uttara Bhadrapada',
      'Revati', 'Anuradha', 'Shravana', 'Dhanishta',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: true,
  },
  mundan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Ekadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Mrigashirsha', 'Pushya', 'Hasta', 'Chitra', 'Swati',
      'Jyeshtha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Sunday', 'Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha', 'Vajra', 'Vishkambha'],
    requiresShuklaPaksha: true,
  },
  annaprashan: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi'],
    auspiciousNakshatras: [
      'Rohini', 'Mrigashirsha', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra',
      'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: false,
  },
  vidyarambh: {
    auspiciousTithis: ['Dwitiya', 'Tritiya', 'Panchami', 'Shashthi', 'Dashami', 'Ekadashi', 'Dwadashi'],
    auspiciousNakshatras: [
      'Ashwini', 'Rohini', 'Mrigashirsha', 'Ardra', 'Punarvasu', 'Pushya',
      'Hasta', 'Chitra', 'Swati', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati',
    ],
    excludedVaras: ['Sunday', 'Tuesday', 'Saturday'],
    excludedYogas: ['Vyatipata', 'Vaidhriti', 'Parigha'],
    requiresShuklaPaksha: false,
  },
};

const VARA_SANSKRIT_TO_ENGLISH = {
  raviwara: 'sunday',
  somawara: 'monday',
  mangalawara: 'tuesday',
  budhawara: 'wednesday',
  guruwara: 'thursday',
  shukrawara: 'friday',
  shaniwara: 'saturday',
};

function ciEq(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function endsWithCI(haystack, needle) {
  return String(haystack).trim().toLowerCase().endsWith(String(needle).trim().toLowerCase());
}

// Mirror of evaluateDay from src/services/astrology/muhurat.ts
function passesRule(panchang, rule) {
  const tithi = panchang.tithis[0];
  const tithiName = tithi?.name ?? '';
  const paksha = tithi?.paksha ?? null;
  const nakshatraName = panchang.nakshatras[0]?.name ?? '';
  const yogaName = panchang.yogas[0]?.name ?? '';
  const varaName = panchang.vara?.name ?? '';
  const varaEnglish = VARA_SANSKRIT_TO_ENGLISH[varaName.trim().toLowerCase()] ?? varaName.toLowerCase();

  if (rule.requiresShuklaPaksha && paksha !== 'Shukla') return false;
  if (!rule.auspiciousTithis.some(t => endsWithCI(tithiName, t))) return false;
  if (!rule.auspiciousNakshatras.some(n => ciEq(n, nakshatraName))) return false;
  if (rule.excludedVaras.some(v => v.trim().toLowerCase() === varaEnglish)) return false;
  if (rule.excludedYogas.some(y => ciEq(y, yogaName))) return false;
  return true;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Generation ──────────────────────────────────────────────────────────────

function generate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const generatedAt = ymd(today);

  // Map<occasion, Set<ymd>>
  const candidateSets = new Map();
  for (const occ of ALL_OCCASIONS) candidateSets.set(occ, new Set());

  // Cache panchang per (refIdx, ymd) to avoid recomputing for each occasion.
  // Memory bound: 5 refs × ~730 days × ~few KB each ≈ <50 MB transient. Fine.
  const panchangCache = new Map();

  for (let dayIdx = 0; dayIdx < LOOKAHEAD_DAYS; dayIdx++) {
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + dayIdx);
    const dayKey = ymd(cursor);

    if (dayIdx % 30 === 0) {
      process.stdout.write(`  day ${dayIdx + 1}/${LOOKAHEAD_DAYS} (${dayKey})\r`);
    }

    // Compute panchang at each reference. Skip refs that error.
    const refResults = [];
    for (let r = 0; r < REFERENCES.length; r++) {
      const ref = REFERENCES[r];
      const cacheKey = `${r}|${dayKey}`;
      let result = panchangCache.get(cacheKey);
      if (result === undefined) {
        try {
          result = getDailyPanchang(
            cursor,
            { latitude: ref.latitude, longitude: ref.longitude },
            { timezone: TIMEZONE, computeEndTimes: false, region: 'all', language: 'en' },
          );
        } catch {
          result = null;
        }
        panchangCache.set(cacheKey, result);
      }
      if (result) refResults.push(result);
    }

    if (refResults.length === 0) continue;

    for (const occ of ALL_OCCASIONS) {
      const rule = RULES[occ];
      if (refResults.some(p => passesRule(p, rule))) {
        candidateSets.get(occ).add(dayKey);
      }
    }
  }

  process.stdout.write('\n');

  const candidates = {};
  for (const occ of ALL_OCCASIONS) {
    candidates[occ] = [...candidateSets.get(occ)].sort();
  }

  return {
    version: 1,
    generatedAt,
    lookaheadDays: LOOKAHEAD_DAYS,
    references: REFERENCES.map(r => r.name),
    candidates,
  };
}

function main() {
  console.log(`Generating muhurat candidates for ${LOOKAHEAD_DAYS} days × ${REFERENCES.length} references × ${ALL_OCCASIONS.length} occasions...`);
  const out = generate();

  for (const occ of ALL_OCCASIONS) {
    console.log(`  ${occ.padEnd(15)} ${out.candidates[occ].length} candidates`);
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'muhurat-candidates.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const bytes = fs.statSync(outPath).size;
  console.log(`\nWritten ${(bytes / 1024).toFixed(1)} KB to ${outPath}`);
}

main();
