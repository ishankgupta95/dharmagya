#!/usr/bin/env node
/* eslint-disable */
// Quick smoke test for the reminder scheduler: mocks "today" and prints the
// list of reminders that would be scheduled for the next 30 days. Pure JS port
// of the TypeScript logic so it can run without a bundler.
//
// Run: node scripts/test-reminder-scheduler.js [YYYY-MM-DD]

// Festival data comes from the table scripts/generate-festivals-table.js builds
// (the same source the app uses via src/data/festivals.ts), flattened into the
// legacy year-keyed shape.
const {
  readFestivalsForYear,
  readFestivalsYearRange,
} = require('panchang-ts/festivals');
const festivalsTable = require('../src/data/static/festivals-table.json');

const festivalsData = (() => {
  const range = readFestivalsYearRange(festivalsTable);
  const out = {};
  for (let y = range.start; y <= range.end; y++) {
    const rows = readFestivalsForYear(festivalsTable, y, 'en');
    if (rows) out[String(y)] = rows;
  }
  return out;
})();

const TITHI_PREFIX = 'dharmagya-tithi-';
const FESTIVAL_PREFIX = 'dharmagya-festival-';
const HORIZON_DAYS = 30;

const TITHI_MATCHES = {
  ekadashi: (f) => f.type === 'ekadashi',
  pradosha: (f) => f.type === 'pradosha',
  purnima: (f) => f.name.toLowerCase().includes('purnima'),
  amavasya: (f) => f.name.toLowerCase().includes('amavasya'),
  sankashti: (f) => f.name.toLowerCase().includes('sankashti') || f.name.toLowerCase().includes('ganesh chaturthi'),
  shivaratri: (f) => f.name.toLowerCase().includes('shivaratri') || f.name.toLowerCase().includes('shivratri'),
};

function enumerateReminders(prefs, now, horizonDays = HORIZON_DAYS) {
  const out = [];
  const nowMs = now.getTime();
  const cutoffMs = nowMs + horizonDays * 24 * 60 * 60 * 1000;
  const years = new Set();
  years.add(now.getFullYear());
  const end = new Date(now);
  end.setDate(end.getDate() + horizonDays);
  years.add(end.getFullYear());

  for (const year of years) {
    const yearData = festivalsData[String(year)];
    if (!yearData) continue;
    for (const day of yearData) {
      const observance = new Date(day.date + 'T00:00:00');
      if (observance.getTime() < nowMs) continue;
      for (const f of day.festivals) {
        for (const key of Object.keys(prefs.tithi)) {
          if (!prefs.tithi[key]) continue;
          if (!TITHI_MATCHES[key](f)) continue;
          const fireAt = new Date(observance);
          fireAt.setDate(fireAt.getDate() - 1);
          fireAt.setHours(19, 0, 0, 0);
          if (fireAt.getTime() < nowMs || fireAt.getTime() > cutoffMs) continue;
          out.push({
            id: `${TITHI_PREFIX}${key}-${day.date}`,
            fireAt,
            title: `tithi:${key}`,
            body: `${f.name} is tomorrow`,
          });
        }
        if (prefs.festival[f.type]) {
          const fireAt = new Date(observance);
          fireAt.setDate(fireAt.getDate() - 1);
          fireAt.setHours(20, 0, 0, 0);
          if (fireAt.getTime() >= nowMs && fireAt.getTime() <= cutoffMs) {
            out.push({
              id: `${FESTIVAL_PREFIX}${f.type}-${day.date}`,
              fireAt,
              title: `festival:${f.type}`,
              body: f.name,
            });
          }
        }
      }
    }
  }

  const byKey = new Map();
  for (const r of out) {
    const ymd = r.fireAt.toISOString().slice(0, 10);
    const key = `${ymd}-${r.title}`;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, r);
    else if (r.id.startsWith(TITHI_PREFIX) && existing.id.startsWith(FESTIVAL_PREFIX)) byKey.set(key, r);
  }
  return [...byKey.values()].sort((a, b) => a.fireAt - b.fireAt);
}

// ─── Run ──────────────────────────────────────────────────────────────────

const dateArg = process.argv[2];
const today = dateArg ? new Date(dateArg + 'T08:00:00') : new Date();
console.log(`Mock "today" = ${today.toISOString()}`);

const allOnPrefs = {
  tithi: { ekadashi: true, pradosha: true, purnima: true, amavasya: true, sankashti: true, shivaratri: true },
  festival: { major: true, minor: true, ekadashi: false, pradosha: false, sankranti: true },
};

const reminders = enumerateReminders(allOnPrefs, today);
console.log(`Next 30 days → ${reminders.length} reminders scheduled:\n`);
for (const r of reminders) {
  console.log(`  ${r.fireAt.toISOString().slice(0, 16)}  ${r.id.padEnd(45)}  ${r.body}`);
}

// Assertions
const assertions = [];
function assert(cond, msg) {
  assertions.push({ ok: !!cond, msg });
}

assert(reminders.length > 0, 'At least one reminder scheduled');
assert(reminders.every(r => r.fireAt >= today), 'All reminders fire in the future');
assert(reminders.every(r => r.fireAt.getTime() <= today.getTime() + 30 * 24 * 60 * 60 * 1000), 'All reminders within 30-day horizon');
// Ids unique
const ids = new Set();
let dup = false;
for (const r of reminders) {
  if (ids.has(r.id)) dup = true;
  ids.add(r.id);
}
assert(!dup, 'All reminder ids unique');

console.log('\nAssertions:');
let failed = 0;
for (const a of assertions) {
  console.log(`  ${a.ok ? '✓' : '✗'} ${a.msg}`);
  if (!a.ok) failed++;
}

process.exit(failed > 0 ? 1 : 0);
