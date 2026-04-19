/**
 * Pre-compute festivals using panchang-ts v2 and write to
 * src/data/static/festivals.json.
 *
 * Per-festival shape: { name, type, description?, deferralDate? }
 * Ekadashi collapse: drops the generic 'ekadashi' entry when a smarta or
 * vaishnava variant is present for the same day.
 *
 * Also merges manual overrides from src/data/static/festival-overrides.json
 * for dates where the library's detection is known to drop entries (e.g.
 * Krishna Janmashtami 2026 — see report).
 *
 * Usage:  node scripts/generate-festivals.js
 */

const { getDailyPanchang } = require('panchang-ts');
const fs = require('fs');
const path = require('path');

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = CURRENT_YEAR - 10;
const END_YEAR = CURRENT_YEAR + 10;

// Pune (fallback coords used in the app)
const GEO = { latitude: 18.6298, longitude: 73.7997 };
const TIMEZONE = 330; // IST = UTC+5:30 = 330 minutes

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function ymdOf(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapFestival(f) {
  const out = { name: f.name, type: f.type };
  if (f.description) out.description = f.description;
  if (f.deferralDate) out.deferralDate = ymdOf(f.deferralDate);
  return out;
}

function collapseEkadashiTriple(list) {
  const hasSubtype = list.some(
    (f) => f.type === 'smarta_ekadashi' || f.type === 'vaishnava_ekadashi'
  );
  return list.filter((f) => !(hasSubtype && f.type === 'ekadashi'));
}

function loadOverrides() {
  const p = path.join(__dirname, '..', 'src', 'data', 'static', 'festival-overrides.json');
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function generateFestivals() {
  const overrides = loadOverrides();
  const result = {};

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const dayMap = new Map(); // ymd -> [festivals]
    process.stdout.write(`Computing ${year}...`);

    for (let m = 0; m < 12; m++) {
      const count = daysInMonth(year, m);
      for (let d = 1; d <= count; d++) {
        const date = new Date(year, m, d);
        try {
          const r = getDailyPanchang(date, GEO, {
            timezone: TIMEZONE,
            computeEndTimes: false,
            region: 'all',
          });
          if (!r || r.festivals.length === 0) continue;
          const ymd = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const mapped = collapseEkadashiTriple(r.festivals).map(mapFestival);
          if (mapped.length > 0) dayMap.set(ymd, mapped);
        } catch {
          // skip problematic dates
        }
      }
    }

    // Merge overrides (for the current year only) — add missing festivals on
    // existing days or introduce new days as needed. Never overwrite the
    // library's output for a festival already present.
    const yearOverrides = overrides[String(year)] ?? {};
    for (const ymd of Object.keys(yearOverrides)) {
      const existing = dayMap.get(ymd) ?? [];
      const existingNames = new Set(existing.map((f) => f.name));
      const merged = [...existing];
      for (const f of yearOverrides[ymd]) {
        if (!existingNames.has(f.name)) merged.push(f);
      }
      dayMap.set(ymd, merged);
    }

    const days = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, festivals]) => ({ date, festivals }));

    result[year] = days;
    const totalEntries = days.reduce((acc, d) => acc + d.festivals.length, 0);
    console.log(` ${days.length} festival days (${totalEntries} entries)`);
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festivals.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to ${outPath}`);
}

generateFestivals();
