> **Status (2026-09-23, updated):** the nine `match.cancellations.*` keys are fixed (unchanged from the previous note).
>
> **§3 dead-key cleanup done.** All 11 non-`sadhana` dead keys in the §3 table were re-verified unreferenced (literal grep + template-literal/dynamic-construction/config-field checks across `app/`, `src/`, `plugins/`, `modules/`, `scripts/`) and deleted from both `en.ts` and `hi.ts`: `dasha.title`, `kundli.cancellation`, `kundli.matchKicker`, `kundli.matchCardTitle`, `kundli.openPrashnaKicker`, `kundli.openPrashna`, `kundli.openVarshaphalaKicker`, `kundli.openVarshaphala`, `match.totalScoreLabel`, `match.pathuPorutham.totalScoreLabel`, `settings.deities`.
>
> **`sadhana.reminderTitle` / `sadhana.reminderBody` kept, not deleted**, despite being in the §3 list and having no call site anywhere (the `sadhanaReminders` scheduler file that would have called them no longer exists in the repo). The owner's standing instruction for this pass is that the whole dormant `sadhana.*` namespace is a deliberate rebuild reference and must not be pruned; `MilestoneCelebrationHost`/`SadhanaStreakBadge` still call the rest of the namespace. Flagging this as an open call for the owner: either these two leaves get a real call site back, or they get an explicit carve-out to delete on a future pass.
>
> **`sadhana.*` namespace: verified present, not restored.** Contrary to PLAN.md §"Remaining" item ("`sadhana.*` was already deleted, commit `7ddf8c5`"), the namespace already exists in both locales in the current working tree (comment above it says "Restored from `7ddf8c5^` verbatim" minus `streakLabel`/`streakDays_*`) and matches what `MilestoneCelebrationHost.tsx`, `SadhanaStreakBadge.tsx` still call. No restoration was needed this pass — PLAN.md's "Remaining" note on this point is stale.
>
> **15 dead `onboarding.*` keys: not found, contrary to PLAN.md §"Remaining".** The current `onboarding` namespace (`src/i18n/locales/en.ts`, `onboarding: {...}` block) has exactly 24 leaf keys, and every one of them has a direct literal `t('onboarding.<key>')` call site in `app/onboarding/{step1,step2,step3,intent,birth}.tsx`, `app/settings/deities.tsx`, or `app/settings/index.tsx` (the last two via the `onboarding.intent_${key}` template literal, which correctly resolves to the three `intent_*` keys). Diffed byte-for-byte against this session's pre-change snapshot to confirm no other agent had already cleaned this up first. PLAN.md's "ninth pass" entry (2026-09-04, "dead `onboarding.*` keys removed") appears to already cover this — the later "Remaining" bullet claiming 15 still-dead keys looks like stale carry-over text that was never removed after that pass landed. No keys were deleted from `onboarding.*` this session.
>
> **Key-parity checker:** written at `scratchpad/i18n-parity-check.mjs` (transpiles both locale files with the `typescript` package's `transpileModule` + Node `vm`, flattens, diffs). Result after the deletions above: **en.ts and hi.ts both flatten to 1294 leaf keys, 0 missing on either side, 0 empty-string leaves.** 8 identical-value (en≈hi) leaks found, all false positives (brand name, acronym, or interpolation/emoji-only strings — see §1 below for the list, unchanged from the prior pass). `tsc --noEmit` and `eslint src/i18n/locales/{en,hi}.ts` are both clean (0 errors / 0 warnings).

# i18n integrity report — `src/i18n/locales/{en,hi}.ts`

Method: wrote `/private/tmp/claude-501/-Users-ishank-code-personal-dharmagya/50cecda6-a0d0-46ec-9ab4-10d5225bd1e4/scratchpad/i18n-parity.mjs` (run via `npx tsx`) to load both bundles as modules and diff their flattened key trees. For the code-reference checks I additionally wrote throwaway helper scripts in the same scratchpad dir (`extract-keys.mjs`, `compare-keys.mjs`, `dead-keys.mjs` — not left behind; only `i18n-parity.mjs`, the one explicitly named in the task, was kept) that regex-scan every `.ts`/`.tsx` under `app/` and `src/` for `t(...)`, `i18n.t(...)` and `tForLang(...)` calls, then cross-check literal keys, template-literal prefixes, and a short list of dynamic-key sites I resolved by hand (ternaries, lookup tables, `*Key` config fields). Nothing in the repo was modified; only the scratchpad script was written, per the task's read-only constraint.

## 1. en.ts ↔ hi.ts structural parity

**Perfect parity.** Both files flatten to exactly **1294 leaf keys**, and the sets are identical:
- Keys in en missing from hi: **0**
- Keys in hi missing from en: **0**
- Empty-string leaf values (either file): **0**

**Untranslated-leak check** (hi value identical to en value, where the en value contains Latin letters): **8 matches, all false positives** — every one is either a brand name, an acronym, an interpolation-only template, or a deliberately-shared label:

| key | value | why it's fine |
|---|---|---|
| `common.appName` | `Dharmagya` | brand name |
| `common.gpsLabel` | `GPS` | acronym |
| `langToggle.english` | `English` | language name is intentionally shown in Latin in both locales (`langToggle.hindi` correctly reads `हिन्दी`) |
| `panchang.eclipseWindow` | `{{start}} – {{end}}` | pure interpolation, no translatable text |
| `dasha.dateRangeLong` | `{{start}} – {{end}}` | same |
| `dasha.dateRangeShort` | `{{start}}–{{end}}` | same |
| `reminders.festivalTitle` | `🪔 {{name}}` | emoji + interpolation only |
| `practice.vaar.subtitle` | `{{day}} — {{deities}}` | same |

No real untranslated-leak content found.

## 2. Keys referenced in code but missing from en.ts

Scanned ~941 distinct literal `t()`/`tForLang()` key calls plus 36 template-literal key prefixes (e.g. `deities.${id}.displayName`, `dasha.planet.${...}`) across `app/` and `src/`. All 36 template-literal namespaces resolve to an existing object in en.ts (structurally present — I could not enumerate every runtime value for prefixes driven by external `panchang-ts` enums, see caveat below).

**Real gaps found — 9 keys, all in one place:**

`app/kundli/match.tsx`'s `CANCELLATION_KEYS` lookup table maps `AshtakootResult.cancellations` strings from `panchang-ts` to i18n keys under `match.cancellations.*`, but **that namespace does not exist in en.ts or hi.ts at all** (only `match.cancellationsLabel` and `kundli.yogas.types.cancellation` exist — different keys). The missing keys:

- `match.cancellations.ganaSameRashiLord`
- `match.cancellations.ganaMutualFriendship`
- `match.cancellations.bhakootSameRashiLord`
- `match.cancellations.bhakootMutualFriendship`
- `match.cancellations.bhakootSameLagnaLord`
- `match.cancellations.bhakootSameSeventhLord`
- `match.cancellations.bhakootSameNavamsaLord`
- `match.cancellations.nadiSameNakshatra`
- `match.cancellations.nadiSameRashi`

Effect: `localizeCancellation()` calls `t(key, { defaultValue: line })` for each — since the key never resolves, it **always** silently falls through to the library's raw English `line` (e.g. "Gana: same rashi-lord"), even in the Hindi UI. Not a crash (the `defaultValue` masks it), but the Hindi translation for kundli-match cancellation reasons was apparently never actually wired up — it just looks like it works because of the fallback.

**Other apparent misses were false positives**, resolved and excluded: 12 keys (`jaap.malaLabel`, `jaap.historyMalaSummary`, `jaap.statsSessionCount`, `library.countAartis`, `library.countChalisas`, `navratri.saptashatiChapters`, `sadhana.a11yStreakBadge`, `sadhana.dayStreakLabel`, `scripture.chaptersN`, `scripture.readAllVerses`, `scripture.subtitleVersesOnly`, `scripture.versesNCount`) are i18next pluralized keys — code calls the bare key (e.g. `t('sadhana.a11yStreakBadge', {count})`) and both bundles correctly define the `_one`/`_other` suffixed pair, so these are not gaps.

**Template-literal prefixes I could not fully resolve at the value level** (namespace confirmed to exist in en.ts, but I couldn't enumerate every runtime code from the external library to verify each specific member is present):
- `muhurat.factor.${factor.code}` — `factor.code` comes from `panchang-ts`'s `MuhurtaFactor`/`STOCK_MUHURTA_RULES`; a future library rule addition could reference a factor code with no matching `muhurat.factor.*` key (falls back to `defaultValue: ''` at the call site in `app/muhurat/index.tsx:911`, so it degrades gracefully, not silently wrong).
- `dasha.planet.${DASHA_LORD_TO_KEY[lord]}`, `dasha.yoginiName.${...}`, `kundli.dignity.${d}`, `kundli.divisional.${kind}`, `kundli.yogas.types.${g.type}`, `kundli.karakas.roles.${role}`, `kundli.bhavaBala.components.${c}`, `match.koots.${kootKey(...)}`, `match.pathuPorutham.poruthams.${poruthamKey(...)}`, `festivals.eclipseSubtype.${e.subtype}` / `panchang.eclipseSubtype.${...}` — all keyed off `panchang-ts` enum/name types (`Dignity`, `YogaType`, `KarakaName`, etc.). I confirmed the parent namespace exists in en.ts with plausible members but did not cross-enumerate every possible library enum value against it.
- `deities.${id}.description` / `.displayName` — keyed off the 19-deity roster; I did not individually re-verify all 19 ids have both fields (the memory notes "19-deity roster" is the confirmed cap; content-accuracy audits already track this separately).

## 3. Dead keys in en.ts (best-effort — no code reference found)

After accounting for the ternary/lookup-table/dynamic-key sites listed above, **13 leaf keys in en.ts had no reachable call site as of the original audit**. **Update 2026-09-23: 11 of the 13 were re-verified unreferenced and deleted from both `en.ts` and `hi.ts` this session — see the status note at the top of this doc. The rows below are struck through / marked DELETED and no longer exist in either file. Only the 2 `sadhana.*` rows remain live (kept deliberately, per the status note above)**:

| key | en.ts value (historical — key no longer exists) | likely cause |
|---|---|---|
| ~~`dasha.title`~~ | **DELETED 2026-09-23** — was "Vimshottari Dasha" | superseded — dasha section title text isn't rendered anywhere now (`dasha.birthDatePickerTitle` is the only dasha *title used) |
| ~~`kundli.cancellation`~~ | **DELETED 2026-09-23** — was "Cancellation" | superseded by `kundli.mangal.cancelledTag`/`cancelledBy` |
| ~~`kundli.matchKicker`~~ | **DELETED 2026-09-23** — was "COMPATIBILITY" | superseded by `kundli.matchOthersKicker` |
| ~~`kundli.matchCardTitle`~~ | **DELETED 2026-09-23** — was "Match two charts (Ashtakoot Guna Milan)" | superseded by `kundli.matchOthersTitle` |
| ~~`kundli.openPrashnaKicker`~~ | **DELETED 2026-09-23** — was "PRASHNA · QUERY CHART" | superseded by `kundli.toolPrashna` (P16.2 Tools-row consolidation) |
| ~~`kundli.openPrashna`~~ | **DELETED 2026-09-23** — was "Cast a prashna chart" | same |
| ~~`kundli.openVarshaphalaKicker`~~ | **DELETED 2026-09-23** — was "ANNUAL CHART" | superseded by `kundli.toolVarshaphala` |
| ~~`kundli.openVarshaphala`~~ | **DELETED 2026-09-23** — was "Varshaphala — annual return chart" | same |
| ~~`match.totalScoreLabel`~~ | **DELETED 2026-09-23** — was "ASHTAKOOT TOTAL" | superseded by `match.systemAshtakoot` (system toggle chip) |
| ~~`match.pathuPorutham.totalScoreLabel`~~ | **DELETED 2026-09-23** — was "PATHU PORUTHAM" | superseded by `match.systemPorutham` |
| ~~`settings.deities`~~ | **DELETED 2026-09-23** — was "DEITIES" | old section-header kicker; current Settings screen uses `settings.manageDeities` inline without it |
| `sadhana.reminderTitle` (still present, not deleted) | "🪔 A quiet moment" | leftover from the removed P14.4 evening-reminder scheduling code |
| `sadhana.reminderBody` (still present, not deleted) | "Begin your sadhana when you have a moment today." | same |

Note on the last two: en.ts's own comment block above the `sadhana` namespace (lines 1609–1616) says the P14.4 streak/milestone mechanic was deliberately restored as a dormant "rebuild reference" (still called by `MilestoneCelebrationHost.tsx` / `SadhanaStreakBadge.tsx`, which are never mounted) and explicitly claims "the two leaves with no call site left ... were not brought back" — but `reminderTitle`/`reminderBody` are exactly that: leaves with no call site, present anyway. Everything else in that `sadhana.*` block (`milestoneKicker.*`, `milestoneSub.*`, `dayStreakLabel_*`, `a11yStreakBadge_*`, `milestoneEyebrow`, `milestoneBlessing`, `continueBtn`) **is** still referenced by the dormant component files, so those are correctly excluded from this list — they're inert in the shipped app but not orphaned in the code.

**Template-literal namespaces I could not fully resolve for dead-code purposes** (so a member could be unreferenced without showing up above): any key under `deities.*`, `dasha.planet.*`, `dasha.yoginiName.*`, `kundli.dignity.*`, `kundli.divisional.*`, `kundli.yogas.types.*`, `kundli.karakas.roles.*`, `kundli.bhavaBala.components.*`, `match.koots.*`, `match.pathuPorutham.poruthams.*`, `*.eclipseSubtype.*`, `muhurat.factor.*`, `muhurat.occasion.*`, `settings.regionOptions.*`/`regionGroup.*`, `stotra.form.*`/`language.*`, `reminders.tithi*.*`/`festival*.*`, `search.kind.*`, `permissionPrompt.*`, `prayers.occasion.*` — I verified the parent namespace is reachable from a template-literal call site, not that every individual child leaf under it is actually hit at runtime.

## Scope note
This is a static-analysis pass (regex over source text, not a TS/AST parse or a runtime i18next trace), so it can miss exotic call patterns (e.g. a key built from string concatenation instead of a template literal, or `t()` invoked through a further-renamed/re-exported wrapper beyond the two names found in this codebase — plain `t` and `tForLang`). No other translation-function aliases were found in `app/` or `src/`.