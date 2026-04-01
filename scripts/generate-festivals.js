/**
 * Pre-compute festivals for 2026–2036 using panchang-ts and write to
 * src/data/static/festivals.json.
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

function generateFestivals() {
  const result = {};

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const days = [];
    process.stdout.write(`Computing ${year}...`);

    for (let m = 0; m < 12; m++) {
      const count = daysInMonth(year, m);
      for (let d = 1; d <= count; d++) {
        const date = new Date(year, m, d);
        try {
          const r = getDailyPanchang(date, GEO, {
            timezone: TIMEZONE,
            computeEndTimes: false,
          });
          if (r.festivals.length > 0) {
            days.push({
              date: `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
              festivals: r.festivals.map((f) => ({ name: f.name, type: f.type })),
            });
          }
        } catch {
          // skip problematic dates
        }
      }
    }

    result[year] = days;
    console.log(` ${days.length} festival days`);
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'festivals.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to ${outPath}`);
}

generateFestivals();
