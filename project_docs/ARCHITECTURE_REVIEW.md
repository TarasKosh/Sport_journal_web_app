# Architecture Review & Hardening

Status: implemented (branch `refactor/architecture-hardening`)
Scope: application architecture, data access, performance/scalability, sync integrity, quality gates
Builds on: `project_docs/AUDIT_IMPLEMENTATION_PLAN.md` (data integrity + settings wiring, already done)

This document records (1) how the app was structured, (2) what was wrong with that structure,
(3) the target architecture, and (4) exactly which changes were implemented, which were
deliberately deferred, and why.

---

## 1. Baseline (before the change)

| Metric | Value |
|---|---|
| Source size | ~7.5k lines across 74 files |
| Components importing Dexie directly | 15 |
| `useLiveQuery` call sites | 25 across 17 files |
| `db.transaction(...)` calls | 4 (all inside services) |
| Tests | 112 in 10 files |
| Initial JS bundle | 1 chunk, 459 kB (139 kB gzip) |
| Error boundaries / in-app confirms | 0 / 5 `window.confirm` |

Layers as they were:

```
main.tsx → App.tsx (HashRouter) → AppShell
                                   │
                16 components + 3 hooks ──► Dexie (directly)
                                   │
   services/data (softDelete) ─────┤
   services/sync (SyncManager) ────┤
                                   ▼
                            db/db.ts → IndexedDB
```

Strengths worth keeping: small and readable codebase; clean domain types
(`src/types/index.ts`); soft-delete + LWW sync; snapshot validation; pure, well-tested
statistics functions (`src/services/stats/calculations.ts`); no backend; offline-first PWA.

---

## 2. Findings

Severity: **P0** correctness/architecture, **P1** scalability, **P2** polish.
"Status" is the state after this branch.

### P0 — missing data-access layer

| # | Finding | Status |
|---|---|---|
| 1 | Components wrote to IndexedDB directly, bypassing transactions | Fixed (repositories) |
| 2 | Workout-editing logic duplicated between `ActiveWorkoutView` and `EditWorkoutModal` (~150 lines each, drifting) | Fixed (`useWorkoutEditor`) |
| 3 | Two identities in one system: domain uses `uuid`, service APIs used local auto-increment `id` (24 non-null assertions in components) | Fixed (repositories are uuid-based; `id` is a data-layer detail) |
| 4 | `updatedAt: Date.now()` hand-written in ~20 places — one omission makes a row invisible to LWW | Fixed (`nowMonotonic` + whole-record writes) |
| 5 | `order` computed outside a transaction: two rapid "Add set" taps produced duplicate orders; a swap used two independent updates | Fixed (transactional) |

### P0 — functional defects found while reading

| # | Defect | Status |
|---|---|---|
| 6 | `EditWorkoutModal`: `setMood(next); handleSaveMetadata();` persisted the **previous** mood (stale closure), and the date field had no blur handler, so a date change was never saved | Fixed + regression test |
| 7 | `useDebounce` had no flush: typing then leaving the screen (or backgrounding) dropped the last <500 ms of edits | Fixed (`useDebouncedWriter`) + test |
| 8 | Prefill used `updatedAt` as "recency", so editing an old workout made it the source of the next set's weight | Fixed (`performedAt`) + regression test |
| 9 | `setState` during render in `WorkoutPage`/`SetItem` for derived values | Fixed (derived / keyed subcomponents) |
| 10 | LWW kept the local copy when `updatedAt` values were equal → two devices could diverge **forever** | Fixed (content-based tie-break) + test |
| 11 | Editing a workout closed the modal on the first field blur (callers passed `onSaved={() => setEditingWorkout(null)}`) | Fixed (call sites) |

### P1 — performance and scalability

| # | Finding | Status |
|---|---|---|
| 12 | "Find the active workout" was a full-table scan (`filter(w => !w.endedAt)`); IndexedDB cannot index `undefined` | Fixed (`status` index) |
| 13 | Last body weight = full scan + JS sort of every workout | Fixed (`[status+startedAt]` range) |
| 14 | **N+1 live queries**: each history card subscribed to its own workout's join rows and sets | Fixed (workout aggregate cache) |
| 15 | "Add set" prefilled by loading every historical set of the exercise | Fixed (`[exerciseId+performedAt]`) |
| 16 | Statistics loaded every table into memory, then filtered by period in JS | Fixed (indexed period range + chunked joins + only referenced exercises) |
| 17 | History rendered every workout; no pagination | Fixed (20/page + "Load more") |
| 18 | One bundle for all routes, charts included | Fixed (route-level `lazy`) |
| 19 | Exercise uuid→row map rebuilt in 4+ components | Fixed (`useExerciseIndex`) |

### P1 — sync

| # | Finding | Status |
|---|---|---|
| 20 | Merge looped record-by-record with `.first()` + `put` inside one transaction | Fixed (chunked `anyOf` + `bulkPut`) |
| 21 | Snapshot read 6 tables in 6 separate transactions → not an atomic view | Fixed (single `ro` transaction) |
| 22 | No referential integrity: a set whose parent is unknown was imported as an invisible orphan | Fixed (skip + report) |
| 23 | `conflictLog` was write-only and grew forever, and travelled in every snapshot | Fixed (bounded retention + read-only UI) |
| 24 | Snapshot version mismatch = hard failure with no migration path | Fixed (supported version range + migration chain) |
| 25 | Two tabs could sync concurrently | Fixed (in-process guard + `navigator.locks`) |
| 26 | Derived fields participated in conflict detection → phantom conflicts | Fixed (`contentSignature` ignores derived fields) |
| 27 | Full snapshot push/pull on every sync | **Deferred** — see §6.1 |

### P2 — quality

| # | Finding | Status |
|---|---|---|
| 28 | No error boundary; failures were `console.error` only | Fixed |
| 29 | 5 native `confirm()`/`prompt()` (blocking, unstylable, untestable) | Fixed (`ConfirmDialog`) |
| 30 | Built-in catalog seeded only on `populate` → existing installs never got new built-ins | Fixed (`ensureCatalog`, `catalogVersion`) |
| 31 | UI/DB separation enforced only by convention | Fixed (ESLint `no-restricted-imports`) |
| 32 | Docs drifted from code (README claimed `date-fns` and vanilla CSS; AGENTS.md described the old stack) | Fixed |
| 33 | `language` setting persisted but unused, no translations | **Deferred** — see §6.3 |
| 34 | Google Drive token kept in memory; re-consent each session | **Deferred** — see §6.5 |

---

## 3. Target architecture

```
src/
├── domain/          Pure rules, no I/O        (workout.ts: tonnage, order, status, day keys)
├── data/
│   ├── AppDatabase  (src/db/db.ts)            Dexie schema + migrations + seed wiring
│   ├── repositories/                          THE only writers/readers of tables
│   ├── queries/                               chunked anyOf helper, period-based stats loader
│   ├── aggregates.ts                          derived workout cache maintenance
│   ├── normalize.ts                           derived/denormalized field repair (shared by
│   │                                          DB upgrades and sync merges)
│   ├── clock.ts                               monotonic write timestamps
│   └── seed.ts                                built-in catalog + idempotent upsert
├── services/
│   ├── sync/                                  pull → merge (LWW + tie-break) → push
│   └── stats/                                 pure calculations (unchanged, 58 tests)
├── hooks/           React glue over repositories (useSettings, useExerciseIndex,
│                    useWorkoutEditor, useDebouncedWriter, useStats, …)
├── components/      UI only — never imports src/db/db (ESLint-enforced)
└── test-utils/      shared test database reset
```

### Invariants

1. **Only `src/data/**` and `src/services/**` may talk to Dexie.** Enforced by ESLint for
   `src/components/**` and `src/hooks/**`. Violations fail CI.
2. **`uuid` is the only identity that crosses layers.** Local `id` exists solely so Dexie can
   address rows.
3. **Every write goes through a repository**, which stamps `updatedAt` with `nowMonotonic()`
   and keeps derived fields consistent, inside a transaction when more than one table changes.
4. **Derived data is never authored by hand**: `status`/`workoutDay`/`setsCount`/`totalTonnage`/
   `exerciseCount` and set-level `exerciseId`/`workoutId`/`performedAt` are produced by
   `normalize.ts` and `aggregates.ts`, and are excluded from conflict detection.
5. **Derived values are recomputed, not trusted, after a sync merge.**

---

## 4. Implemented changes

### 4.1 Schema v5 (`src/db/db.ts`)

Seven new indexes and three derived-cache fields:

| Table | New indexes | Why |
|---|---|---|
| `workouts` | `status`, `[status+startedAt]`, `[status+workoutDay]` | index lookup for the active workout; period ranges; ordered history pages |
| `workoutExercises` | `[workoutId+order]` | ordered list straight from the index (no JS sort) |
| `sets` | `exerciseId`, `workoutId`, `[exerciseId+performedAt]` | last/recent performance per exercise |

`workouts` gained `status`, `setsCount`, `totalTonnage`, `exerciseCount`;
`sets` gained `exerciseId`, `workoutId`, `performedAt`.
The v5 `upgrade` backfills everything for existing installs (derives `status`, denormalizes
sets from their parents, recomputes aggregates). Existing `version(1..4)` blocks are untouched.

### 4.2 Data layer

- `src/data/repositories/`: `Workout`, `Set`, `Exercise`, `WorkoutExercise`, `Template`,
  `Settings`, `Conflict` — all multi-table writes are transactional.
- `src/data/clock.ts`: strictly increasing timestamps (survives clock skew and NTP jumps).
- `src/data/normalize.ts`: one repair path for DB upgrades **and** sync merges;
  `contentSignature` compares records ignoring derived fields.
- `src/data/aggregates.ts`: incremental aggregate deltas, plus `recountWorkout` for
  crash-recovery and post-merge repair.
- `src/data/queries/anyOf.ts`: bounded `anyOf` chunks (IndexedDB degrades with thousands of keys).
- `src/data/queries/stats.ts`: loads exactly the rows a period needs.
- `src/data/seed.ts`: built-in catalog + idempotent `ensureCatalog` upsert driven by
  `settings.catalogVersion` (fixed: existing installs never received new built-ins).

### 4.3 UI

- Every component now reads/writes through repositories (0 direct `db` imports outside
  `src/data`/`src/services`, enforced).
- `useWorkoutEditor` removes the duplicated workout-composition logic.
- `useExerciseIndex` replaces four locally rebuilt maps.
- `useDebouncedWriter` persists on blur/unmount/tab-hide and immediately for discrete actions.
- `ConfirmDialog` replaces all native `confirm`/`prompt` usages.
- `ErrorBoundary` wraps the app; `App.tsx` lazy-loads non-landing routes.
- History is paginated (20/page); `WorkoutCard` reads the aggregate cache instead of
  subscribing to its own sets; `ExerciseDetails` reads recent sets from the index.

### 4.4 Sync

- Batched merge: `anyOf` in chunks → in-memory LWW decision → `bulkPut`; conflict rows
  `bulkAdd`ed, and only when payloads actually diverge.
- Deterministic convergence: equal `updatedAt` + divergent payload → the lexicographically
  greater `contentSignature` wins on both devices.
- Normalized comparison (both sides) so defaults filled in by a peer do not look like edits.
- Referential integrity: rows whose parent is unknown are skipped and reported
  (`MergeReport.skippedOrphans`) instead of becoming invisible orphans.
- Aggregates are recounted for every workout the merge touched.
- Snapshot is read in one transaction; sync runs under an in-process guard plus
  `navigator.locks`; the conflict log is pruned after each sync.
- Snapshot validation accepts a supported version range with a forward-migration chain and
  rejects newer snapshots with an actionable message. Sets must carry `workoutExerciseId`.

### 4.5 Quality gates

- ESLint rule pinning the UI/DB boundary.
- 165 tests in 18 files (was 112 in 10), including regressions for findings #6, #7, #8, #10, #25
  and repository guarantees (unique orders under concurrent adds, aggregate deltas, indexed
  vs legacy lookups).
- CI (lint + `tsc -b` + `vitest run`) unchanged and green.

### 4.6 Measured effect

| Metric | Before | After |
|---|---|---|
| Initial JS | 459 kB (139 kB gzip) | 399 kB (125 kB gzip) + 4 lazy route chunks |
| Route chunks | — | Stats 17.7 kB, Exercises 18.0 kB, History 22.0 kB, Settings 23.7 kB |
| Components importing Dexie | 15 | 0 (lint-enforced) |
| Tests | 112 / 10 files | 165 / 18 files |

Lazy chunks are precached by the service worker, so offline behaviour is unchanged.

---

## 5. Migration notes

- **Existing installs**: Dexie upgrades to v5 on first launch; the `upgrade` callback backfills
  `status`, denormalized set keys and aggregates. No user action, no data loss (soft-deleted
  rows are preserved and counted as `status: 'deleted'`).
- **Snapshots**: format stays at `schemaVersion: 3`; older supported versions are migrated
  forward. A snapshot from a *newer* app version is rejected with a clear message rather than
  merged blindly. `catalogVersion` is treated as device-local and excluded from conflicts.
- **Older clients** that push sets without `exerciseId`/`performedAt` still work: reads fall back
  to the join path (`SetRepository.recentByExercise`/`lastPerformance` legacy branches).

---

## 6. Deliberately deferred

### 6.1 Incremental (delta) sync

Still a full snapshot per sync. A delta protocol changes the on-wire format on **both** ends and
needs an accumulating remote document; it cannot be validated here (single device, no live Drive
credentials) and would break compatibility with snapshots already in users' Drive. Sketch:
add `syncedAt`/dirty tracking per record (or a changelog table) and push
`{ since, changes[], tombstones[] }`, keeping a periodic full snapshot as compaction.

### 6.2 Tombstone compaction

Old `deletedAt` rows are never pruned: pruning requires knowing that **every** device has seen
the tombstone, otherwise a deleted workout can be resurrected by a device that never learned
about the deletion. Safe implementation needs a device registry (last successful sync per
`deviceId`), which itself needs the delta protocol above. Conflict-log pruning *is* implemented
because it is local-only and cannot resurrect data.

### 6.3 Internationalisation

`settings.language` remains persisted but unused. Wiring it means extracting every UI string —
a self-contained project. The field is kept so the data model does not need another migration.

### 6.4 History virtualisation

Pagination covers realistic journals. Virtual list rendering (`react-window` or similar) adds a
dependency and only pays off for lists in the thousands.

### 6.5 Google Drive session lifetime

The access token stays in memory and each session re-consents. Persisting a refresh token is a
security decision (storage, revocation, PKCE) rather than an architectural one, so it was left
untouched.

### 6.6 Statistics in a Web Worker

Period loading is now index-bounded; the remaining aggregation is pure JS over one period and is
fast at current volumes. If "all time" over multi-year histories becomes slow, move
`loadStatsInput` + `calculations` behind a worker.

---

## 7. Working in this codebase

Adding a feature:

1. Model/reuse types in `src/types`; put pure rules in `src/domain`.
2. Add or extend a repository in `src/data/repositories`; keep multi-table writes transactional
   and let it stamp `updatedAt` and derived fields.
3. Expose it to React through a hook (`src/hooks`) using `useLiveQuery` for reads.
4. Build the component; never import `src/db/db` (ESLint will fail).
5. If you add a schema field: new `version(n+1)` block with an `upgrade` that uses
   `normalize.ts`; if a field is renamed/removed, add a snapshot migration in
   `services/sync/validateSnapshot.ts`.
6. If a change alters user-visible payloads, add a regression test (the existing suites show the
   pattern) and keep `npm run lint && npx tsc -b && npm test` green.

Verification commands: `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`.
