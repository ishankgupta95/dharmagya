import { type SQLiteDatabase } from 'expo-sqlite';
import { pmark, ptime } from '@/utils/perfProfile';

const MUHURAT_CACHE_DDL = `
  CREATE TABLE IF NOT EXISTS muhurat_cache (
    occasion TEXT NOT NULL,
    lat_key TEXT NOT NULL,
    lon_key TEXT NOT NULL,
    ayanamsa TEXT NOT NULL DEFAULT 'lahiri',
    matches_json TEXT NOT NULL DEFAULT '[]',
    scanned_through TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (occasion, lat_key, lon_key, ayanamsa)
  );
`;

/**
 * Festival years OUTSIDE the bundled table (2020–2050), computed on-device once
 * and kept here — read and written only by `src/services/festivalYearCache.ts`,
 * whose header has the full story. Created by rung 13.
 *
 * The key is everything the answer depends on. `region` / `ayanamsa` /
 * `masa_system` are the parameters the year was computed under (today always
 * the bundled table's own build settings, read from its `_meta`, so a computed
 * 2051 answers exactly as the shipped 2050 does); `engine_version` is the
 * panchang-ts that computed it, so an engine bump misses rather than serving
 * last release's dates; `ref_key` is the reference point + offset, so moving
 * the table's reference location cannot resurrect rows computed at the old one.
 * Rows for any other tuple are dead and are pruned on the first write of a
 * session, as are rows for years a regenerated table has since absorbed.
 *
 * `days_json` is the decoded English `FestivalTableDay[]` — the exact shape
 * `readFestivalsForYear(table, year, 'en')` returns, ~27 KB a year.
 * `days_done` makes a row resumable, like `muhurat_cache.scanned_through`: it is
 * the number of engine days (of the year's 365/366) the JSON covers, so a
 * compute stopped halfway picks up where it left off; a row is complete only
 * when it equals the year's day count.
 */
const FESTIVAL_YEAR_CACHE_DDL = `
  CREATE TABLE IF NOT EXISTS festival_year_cache (
    year INTEGER NOT NULL,
    region TEXT NOT NULL,
    ayanamsa TEXT NOT NULL,
    masa_system TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    ref_key TEXT NOT NULL,
    days_json TEXT NOT NULL DEFAULT '[]',
    days_done INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (year, region, ayanamsa, masa_system, engine_version, ref_key)
  );
`;

/**
 * How long after `initDatabase` returns the one-shot VACUUM waits.
 *
 * `initDatabase` runs in `SQLiteProvider`'s `onInit` under `useSuspense`, so
 * every statement in it sits on the cold-start critical path ahead of the first
 * frame. VACUUM rewrites the whole file, which on the ~10 MB ceiling below is
 * hundreds of milliseconds to seconds on a low-end device — a startup stall
 * traded for disk we can just as well reclaim a moment later. So it is
 * scheduled, not awaited: `initDatabase` resolves, the app paints, and the
 * rewrite happens with the UI already up. 5s clears first paint plus the
 * panchang compute and first muhurat-cache read that follow it, and is short
 * enough that an ordinary session reaches it.
 */
const VACUUM_DELAY_MS = 5000;

/**
 * Don't rewrite the file to win back less than this. Below a quarter-megabyte
 * the rewrite costs more (a full copy, plus the wear) than the space is worth,
 * and SQLite reuses free pages for new rows anyway — the problem this solves is
 * a high-water mark that never comes down, not free pages as such.
 */
const VACUUM_MIN_RECLAIMABLE_BYTES = 256 * 1024;

/**
 * The highest rung in the migration ladder below. Named because the deferred
 * vacuum callback has to write it too — see the note there on why the vacuum
 * claims the whole ladder rather than just its own rung.
 */
const LADDER_TOP = 14;

/**
 * Reclaim the disk that the muhurat-cache wipes (rungs 2/5/7/8, and 12 / 14 when
 * they land on the same pass) and the v9 `DROP TABLE` freed inside the file but
 * never returned to the filesystem.
 * `auto_vacuum` is NONE (the default, and never set otherwise here), so those
 * pages go on the freelist and `dharmagya.db` keeps its high-water mark
 * forever — roughly 1 MB for a 1.9.1 user who opened one occasion, with a
 * ceiling near 10 MB.
 *
 * Three things decide the shape of this:
 *  - VACUUM cannot run inside a transaction, and `initDatabase` now wraps its
 *    whole body in one, so this genuinely cannot be folded into a rung — it has
 *    to be scheduled out of the transaction as well as off the startup path.
 *  - It must not run on the startup path — see VACUUM_DELAY_MS.
 *  - It must not run on every launch. `version < 10` at init time is the
 *    once-only gate, and the version is bumped only after the work is done, so
 *    a failure (a rejected `execAsync`, the connection closing under a
 *    backgrounded app) leaves the rung armed and the next cold start simply
 *    tries again.
 *
 * Nothing in here can break `initDatabase`: it is scheduled rather than
 * awaited, and the whole body is caught. The worst outcome of a permanent
 * failure is the file staying at the size it is today.
 */
/** Guards against a second `initDatabase` in the same JS session (a provider
 *  remount) queuing a second rewrite alongside the first — both would read the
 *  same pre-migration `user_version` and arm the rung. */
let vacuumScheduled = false;

function scheduleOneShotVacuum(db: SQLiteDatabase): void {
  if (vacuumScheduled) return;
  vacuumScheduled = true;
  setTimeout(() => {
    void (async () => {
      try {
        const free = await db.getFirstAsync<{ freelist_count: number }>('PRAGMA freelist_count');
        const size = await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
        const reclaimable = (free?.freelist_count ?? 0) * (size?.page_size ?? 0);
        if (reclaimable >= VACUUM_MIN_RECLAIMABLE_BYTES) {
          const end = ptime('db:vacuum');
          await db.execAsync('VACUUM');
          end();
        }
        // Reached on both paths — a fresh install with nothing to reclaim has
        // satisfied this rung too, and re-reading the freelist on every launch
        // to learn that again is pointless.
        //
        // This claims the WHOLE ladder, not just rung 10. Rungs 11 (the stale
        // DROPs), 12 and 14 (the muhurat-cache wipes) and 13 (the festival-year
        // cache table) deliberately leave the version bump to this callback
        // whenever the vacuum is still pending, precisely so that a
        // `user_version` of 9 keeps meaning "rung 10 has not run yet" — a single
        // integer cannot say "11–14 done, 10 pending", so they are all claimed
        // together here.
        //
        // Guarded, because this write lands ~5 s after `initDatabase` returned.
        // An unconditional write would silently DOWNGRADE the schema the moment
        // a future rung bumps past LADDER_TOP within the same session: the
        // ladder would set LADDER_TOP + 1, this timer would put it back to
        // LADDER_TOP, and that newer rung would then re-run on every launch
        // forever. Only claim if nothing has
        // moved the version on since it was armed.
        const cur = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((cur?.user_version ?? 0) < LADDER_TOP) {
          await db.execAsync(`PRAGMA user_version = ${LADDER_TOP}`);
        }
      } catch {
        // Left below 10 on purpose: the next cold start re-arms the rung (and
        // re-runs rung 11's DROPs, which are `IF EXISTS` no-ops by then, rungs
        // 12 and 14's wipes, which are idempotent, and rung 13's `CREATE TABLE
        // IF NOT EXISTS`, which is a no-op once the table exists). Silent because
        // there is nothing the user could do and nothing is lost — the file
        // merely stays the size it already was.
      }
    })();
  }, VACUUM_DELAY_MS);
}

// Called via SQLiteProvider's onInit — receives the same connection
// that will be provided to all children, so no second connection is opened.
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  pmark('db:initDatabase:start');
  const end = ptime('db:initDatabase');

  // Everything below is a write, and SQLite gives every unwrapped statement its
  // own implicit transaction — so this was ~20 separate commits (and fsyncs) on
  // a path that runs inside `SQLiteProvider`'s suspending `onInit`, ahead of
  // first paint. One explicit transaction collapses them into a single commit.
  // It also makes the migration ladder atomic, which it never was: a crash
  // between a rung's work and its `PRAGMA user_version` bump used to leave a
  // half-applied schema that claimed to be fully migrated.
  //
  // VACUUM is the one thing that cannot live in here — it refuses to run inside
  // a transaction — and it is already deferred off this path entirely (see
  // `scheduleOneShotVacuum`). It is armed only after the ladder has COMMITTED:
  // arming it from inside the transaction would leave the timer running after a
  // rollback, and it would then stamp `user_version = LADDER_TOP` onto a
  // database whose tables were never created.
  let vacuumNeeded = false;

  db.withTransactionSync(() => {
    const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;

    // Muhurat cache — persists a rolling 365-day scan per
    // (occasion, location, ayanamsa). lat_key/lon_key are coordinates rounded to
    // 1 decimal (~11km) so nearby users share cache; ayanamsa is part of the key
    // because it changes which nakshatra/yoga the day is scored on, so a row
    // scanned under Lahiri is not an answer for a Raman user. matches_json holds
    // MuhuratMatch[] with only the windows the card renders (rahu kalam, abhijit,
    // brahma, auspicious choghadiya) — the whole IPanchangDay used to be embedded
    // and made a single occasion row ~2.4 MB. scanned_through is the last
    // YYYY-MM-DD successfully evaluated; a partial scan can resume from there.
    // Past matches (date < today) are pruned on write.
    db.execSync(MUHURAT_CACHE_DDL);

    // Jaap (mantra) sessions — written when a user completes a counter session.
    // mantra_slug is either a slug from hindu-devotional-texts or the literal
    // "custom" for free-form mantras. mantra_label snapshots the title at write
    // time so the history list renders without re-resolving the package (and so
    // a custom mantra's typed text persists). mala_size is the bead count the
    // user picked (108 default). total_count = mala_count * mala_size + extras
    // — written once on session end; we deliberately don't store live progress
    // (sessions are sealed, the app is the source of truth for the running count).
    db.execSync(`
      CREATE TABLE IF NOT EXISTS jaap_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        mantra_slug TEXT NOT NULL,
        mantra_label TEXT NOT NULL,
        mala_size INTEGER NOT NULL,
        mala_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL
      );
    `);
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_jaap_sessions_started_at
        ON jaap_sessions(started_at DESC);
    `);

    // Custom mantras the user typed in the jaap picker. We persist them so they
    // don't have to retype — listed by `last_used_at DESC` in the picker.
    // `text` is the natural key (UNIQUE) so retyping the same mantra just bumps
    // recency rather than creating a dupe.
    db.execSync(`
      CREATE TABLE IF NOT EXISTS custom_mantras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      );
    `);
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_custom_mantras_last_used_at
        ON custom_mantras(last_used_at DESC);
    `);

    // Sadhana milestones the user has crossed (P14.4). `kind` is one of
    // 'sessions' | 'repetitions' | 'streak'; `threshold` is the sacred-number
    // boundary just crossed (108, 1008, …). UNIQUE(kind, threshold) makes the
    // insert idempotent — re-crossing the same threshold doesn't double-log
    // and doesn't re-trigger the celebration overlay.
    db.execSync(`
      CREATE TABLE IF NOT EXISTS milestones_achieved (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        achieved_at INTEGER NOT NULL,
        UNIQUE(kind, threshold)
      );
    `);

    // 1: 1.5.0 — excludedVaras rule was a no-op before (English weekday vs.
    // panchang-ts Sanskrit name), so cached scans may include forbidden
    // weekdays. Drop them once so the next open recomputes correctly.
    // 2: panchang-ts 3.1.0 — runtime now validates muhurats with the library's
    // stock rules + scoreMuhurta (Bhadra / Panchaka / Adhika Maasa / eclipse /
    // Ganda Mula exclusions added vs. the prior local rules). Old caches will
    // contain days the new rules now reject, so wipe once on upgrade.
    // 3: 1.6.0 — jaap_sessions table introduced. No old data to migrate; the
    // bump just records that the schema reached version 3.
    // 4: custom_mantras table introduced. No old data to migrate; bump records
    // that the schema reached version 4.
    // 5: MuhuratMatch gained `score` + `reasons` (Phase 13b, 4.1 score surface).
    // Old cache JSON lacks both fields; wipe muhurat_cache once so every row
    // re-fills with the score data the DayRow now renders.
    // 6: milestones_achieved table introduced (P14.4 sadhana milestones). No
    // old data to migrate; the bump just records that the schema reached v6.
    // 7: panchang-ts 5.x. Two independent reasons to wipe muhurat_cache: the
    // embedded `IPanchangDay` gained collection-shaped `varjyam` / `amritKala`
    // (old rows carry the removed `varjyamStart` scalars and would render blank
    // rows), and the stock muhurta rules were themselves rebuilt against
    // DrikPanchang's published calendars — 26 defects across all 13 rules, plus
    // Vara×Tithi yoga scoring and Bhadra demoted from whole-day veto to a
    // penalty — so cached scans list days the new rules reject and omit days
    // they now accept.
    // 8: muhurat scoring realigned with the panchang it renders. `scoreMuhurta`
    // was scoring a hardcoded Pune at a hardcoded +05:30 while the card rendered
    // `fetchPanchang` at Ujjain (or a live GPS fix) in the device's offset;
    // both now resolve to one coordinate and one offset. That moves 11–19 cached
    // days a year per occasion for a user with no saved location, and in the
    // Americas re-frames which Hindu day was scored at all (88 of 90 days at
    // UTC−07:00). Cache rows are pruned by date but never re-evaluated, so
    // without a wipe those users would carry the wrong dates for up to a year.
    // `MuhuratMatch` also gained `factors` — the structured, localizable form of
    // `reasons` — which old rows do not carry.
    // 9: three changes that all invalidate the muhurat rows at once. (a) The
    // scan now honours the user's ayanamsa setting instead of silently using
    // Lahiri, and `ayanamsa` joins the primary key — `CREATE TABLE IF NOT
    // EXISTS` cannot restructure a key, so the table is dropped and rebuilt by
    // the CREATE above on the same init pass. (b) `MuhuratMatch` no longer
    // embeds the full `IPanchangDay`; it carries a narrow `windows` struct, and
    // an old row would render zero choghadiya slots. (c) The scoring offset is
    // now resolved for the place and the day rather than read off the phone at
    // call time, which re-frames which Hindu day was scored for anyone outside
    // IST. Cache rows are pruned by date but never re-evaluated, so without a
    // wipe those users would carry the wrong dates for up to a year.
    // 10: maintenance, not schema — the first rung that changes no table. Every
    // rung above frees pages without shrinking the file (see
    // `scheduleOneShotVacuum`), so this one runs a single VACUUM. It needs a
    // version of its own rather than riding inside rung 9 for two reasons: the
    // vacuum is deferred off the startup path and so cannot be recorded by a
    // synchronous bump alongside the DROP, and rung 9 has already run on the
    // dev/test devices that need reclaiming most, which would leave them at
    // their high-water mark forever. The bump happens in the deferred callback,
    // not here.
    // 11: retires the five stale `DROP TABLE IF EXISTS` (aartis / chalisas /
    // kathas / rashifal / meta) that used to run unconditionally at the top of
    // this function — on every cold start, forever, ahead of first paint, for
    // tables that no install created after 1.6.x. Behind a rung they run once per
    // install and then stop. They stay `IF EXISTS` because the rung can legitimately
    // re-run: see the bump note below.
    // 12: muhurat evaluation re-anchored to the place's calendar day. Rungs 8
    // and 9(c) put the scoring OFFSET on the place, but the INSTANT scored was
    // still the device's local noon, and `scoreMuhurta` picks the Hindu day off
    // that instant in the offset it is given: at or west of −06:30 (US
    // Mountain/Pacific, Alaska, Hawaii) device noon on day D is already 00:30
    // IST on D+1, so every row those devices wrote scored D+1 under a
    // `MuhuratMatch.date` of D, and the bundled candidates (generated at Ujjain
    // for D) were validated against the wrong day. `evaluateAndDescribe` now
    // scores noon of the civil date in the place's own zone (`noonAtPlace`).
    // Cache rows are pruned by date but never re-evaluated, so without a wipe
    // those users would carry the misframed dates for up to a year. Devices in
    // the place's zone were unaffected and pay one re-scan for the wipe. No
    // schema change; the bump is claimed by the version block below.
    // 13: festival_year_cache introduced — festival years outside the bundled
    // 2020–2050 table, computed on-device once by `services/festivalYearCache`
    // and kept here (see FESTIVAL_YEAR_CACHE_DDL). New table, nothing to
    // migrate. Gated on the rung rather than run on every launch like the
    // tables above: those predate the ladder, and gating keeps one statement
    // off the pre-paint path for every install already at 13. It is `IF NOT
    // EXISTS` so the rung stays safely re-runnable while rung 10's vacuum is
    // outstanding — the same bump note as rungs 11 and 12.
    // 14: panchang-ts 5.4 redefined Brahma Muhurta — the 14th of the 15 night
    // muhurtas (~96 to 48 min before sunrise), where 5.3 used two daylight/30
    // muhurtas ending at sunrise (~48 to 24 min). `MuhuratMatch.windows` embeds
    // that window and the Muhurat finder's slot list renders it straight from
    // the cached row, next to a Panchang tab showing the new one for the same
    // date. Scores, passes and every other window are unchanged (checked across
    // all stock rules), so only a wipe is needed; rows are pruned by date but
    // never re-evaluated. Idempotent, same bump note as rungs 11–13.
    if (version < 2) {
      db.execSync('DELETE FROM muhurat_cache');
      db.execSync('PRAGMA user_version = 2');
    }
    if (version < 3) {
      db.execSync('PRAGMA user_version = 3');
    }
    if (version < 4) {
      db.execSync('PRAGMA user_version = 4');
    }
    if (version < 5) {
      db.execSync('DELETE FROM muhurat_cache');
      db.execSync('PRAGMA user_version = 5');
    }
    if (version < 6) {
      db.execSync('PRAGMA user_version = 6');
    }
    if (version < 7) {
      db.execSync('DELETE FROM muhurat_cache');
      db.execSync('PRAGMA user_version = 7');
    }
    if (version < 8) {
      db.execSync('DELETE FROM muhurat_cache');
      db.execSync('PRAGMA user_version = 8');
    }
    if (version < 9) {
      // `CREATE TABLE IF NOT EXISTS` above cannot widen an existing primary key,
      // so the pre-v9 table survives with no `ayanamsa` column and every write
      // would fail. Drop and rebuild; there is nothing worth migrating, since
      // every stored row is invalidated by this version anyway.
      db.execSync('DROP TABLE IF EXISTS muhurat_cache');
      db.execSync(MUHURAT_CACHE_DDL);
      db.execSync('PRAGMA user_version = 9');
    }
    if (version < 11) {
      // Aartis/chalisas/kathas were previously seeded into SQLite; they now come
      // from the `hindu-devotional-texts` package at runtime. Kathas are removed
      // from the app entirely. Rashifal was a 30-day pilot that has been removed.
      // Drop all orphaned tables on existing installs.
      db.execSync('DROP TABLE IF EXISTS aartis');
      db.execSync('DROP TABLE IF EXISTS chalisas');
      db.execSync('DROP TABLE IF EXISTS kathas');
      db.execSync('DROP TABLE IF EXISTS rashifal');
      db.execSync('DROP TABLE IF EXISTS meta');
    }
    if (version < 12) {
      // Idempotent on purpose: like rung 11 it can re-run while rung 10's
      // vacuum is still outstanding (see the bump note below).
      db.execSync('DELETE FROM muhurat_cache');
    }
    if (version < 13) {
      // Idempotent for the same reason as rungs 11 and 12.
      db.execSync(FESTIVAL_YEAR_CACHE_DDL);
    }
    if (version < 14) {
      // Idempotent for the same reason as rungs 11–13.
      db.execSync('DELETE FROM muhurat_cache');
    }
    if (version < 10) {
      // Deferred and self-gating — it bumps the version itself once the file has
      // actually been rewritten. Only flagged here; the timer is armed after the
      // transaction commits, so a rollback cannot leave a callback in flight that
      // would claim the ladder for a migration that never landed.
      //
      // Note what is NOT here: a synchronous bump to 11, 12, 13 or 14.
      // `user_version` is one integer and cannot encode "rungs 11–14 done, rung
      // 10 still pending", so while the vacuum is outstanding the version is
      // deliberately left where it is — that is what keeps rung 10 re-armable if
      // the app dies before the timer fires. The callback then claims 10–14
      // together. The cost is that rung 11's five DROPs, rungs 12 and 14's wipes
      // and rung 13's CREATE re-run on those launches: five `IF EXISTS` no-ops,
      // two cheap DELETEs on a table that is empty or has at most one launch's
      // worth of rows, and one `IF NOT EXISTS` no-op.
      vacuumNeeded = true;
    } else if (version < LADDER_TOP) {
      // Vacuum already done on this install, so nothing else is outstanding and
      // rungs 11–14 can be claimed here and now.
      db.execSync(`PRAGMA user_version = ${LADDER_TOP}`);
    }
  });

  if (vacuumNeeded) scheduleOneShotVacuum(db);
  end();
}
