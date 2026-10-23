# Agents Guide — Sport Journal Web App

This file provides context and instructions for AI agents (coding assistants, LLMs, etc.) working on this project.

---

## Project Summary

**Strength Training Journal** is an offline-first Progressive Web App (PWA) for logging and analyzing strength training workouts. All data is stored locally in the browser's IndexedDB via Dexie.js. An optional Google Drive sync and manual JSON Export/Import provide cloud backup via a single-file snapshot strategy.

---

## Tech Stack

| Layer        | Technology                                             |
|--------------|--------------------------------------------------------|
| Framework    | Vite 7 + React 19 + TypeScript                         |
| Database     | Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks     |
| Styling      | Tailwind CSS 4 (`@theme` tokens in `src/index.css`)    |
| Icons        | Lucide React                                           |
| Routing      | React Router DOM v7 (HashRouter)                       |
| Utilities    | clsx (class merging), uuid v13                         |
| Sync         | Google Drive REST API (optional) + local JSON Export/Import |
| Build/Dev    | Vite 7, vite-plugin-pwa                                |
| Linting      | ESLint 9 + typescript-eslint                           |
| Testing      | Vitest 4 + Testing Library + fake-indexeddb            |

---

## Project Structure

```
src/
├── App.tsx                 # Root component, routing setup (HashRouter)
├── main.tsx                # Entry point
├── index.css               # Global CSS variables, dark theme, layout
├── db/
│   └── db.ts               # Dexie database (AppDatabase), schema versions 1–5, migrations + seed wiring
├── types/
│   └── index.ts            # Shared TypeScript interfaces and enums
├── domain/
│   └── workout.ts          # Pure rules: tonnage, ordering, status, day keys
├── data/
│   ├── repositories/       # The only readers/writers of tables (uuid-based APIs)
│   ├── queries/            # Chunked anyOf helper + period-bounded stats loader
│   ├── aggregates.ts       # Derived workout cache maintenance
│   ├── normalize.ts        # Derived/denormalized repair (DB upgrades + sync merges)
│   ├── clock.ts            # Monotonic write timestamps (LWW safety)
│   └── seed.ts             # Built-in catalog + idempotent upsert
├── hooks/                  # useSettings, useWorkoutEditor, useExerciseIndex, useDebouncedWriter, ...
├── test-utils/             # Shared test database reset
├── services/
│   ├── sync/               # Sync engine
│   │   ├── SyncManager.ts  # Batched, convergent snapshot merge (LWW + tie-break)
│   │   ├── GoogleDriveProvider.ts  # Google Drive REST API provider
│   │   ├── FileProvider.ts         # Local JSON Export/Import provider
│   │   └── types.ts        # SyncSnapshot, SyncProvider, SyncStatus interfaces
│   ├── data/               # softDelete cascade helpers (id-based, used by repositories)
│   └── stats/              # Pure statistics calculations
├── assets/                 # Static assets (icons, images)
└── components/
    ├── common/             # Primitives: Button, Card, Input, ModalShell, ConfirmDialog, ErrorBoundary
    ├── layout/             # App shell (AppShell), navigation
    ├── workouts/           # Active workout: WorkoutPage, ActiveWorkoutView, SetItem,
    │                       #   WorkoutSetList, ExercisePickerModal, EditWorkoutModal,
    │                       #   TemplatePickerModal, WorkoutDayPickerModal
    ├── history/            # Completed workout history: HistoryList, WorkoutCard, WorkoutDetailsView
    ├── exercises/          # Exercise library: ExerciseList, ExerciseDetails,
    │                       #   EditExerciseModal, WorkoutTemplateList, EditWorkoutTemplateModal
    ├── stats/              # Statistics: tonnage over time (line chart), muscle distribution
    │                       #   over time (stacked area + multi-line charts), body weight trend, 1RM estimates
    ├── settings/           # User preferences: SettingsPage (mass unit, theme, RPE type, language)
    └── sync/               # Sync UI: SyncPage (Google Drive + JSON export/import)
```

---

## Core Domain Models (`src/types/index.ts`)

| Interface          | Key Fields                                                                 |
|--------------------|----------------------------------------------------------------------------|
| `Workout`          | `uuid`, `startedAt`, `endedAt`, `workoutDay`, `title?`, `tags?`, `mood?`, `bodyWeight?`, `notes?`, `status?`\*, `setsCount?`\*, `totalTonnage?`\*, `exerciseCount?`\* |
| `Exercise`         | `uuid`, `name`, `muscleGroup`, `movementType?`, `equipment?`, `aliases?`, `variations?`, `isCustom`, `notes?`, `isUnilateral?` |
| `WorkoutExercise`  | `uuid`, `workoutId`, `exerciseId`, `order`, `notes?`                       |
| `SetEntry`         | `uuid`, `workoutExerciseId`, `order`, `weight`, `reps`, `variation?`, `rpe?`, `rir?`, `restSec?`, `isWarmup`, `isFailure`, `failureRep?`, `side?`, `notes?`, `exerciseId?`\*, `workoutId?`\*, `performedAt?`\* |
| `WorkoutTemplate`  | `uuid`, `name`, `description?`, `exercises` (array of exercise UUIDs), `isCustom` |
| `Settings`         | `massUnit` (kg/lb), `weightStep`, `defaultRPEType`, `theme` (dark/light/system), `language`, `catalogVersion?` |
| `ConflictLog`      | `uuid`, `entityType`, `entityId`, `localUpdatedAt`, `remoteUpdatedAt`, `resolvedAt?`, `resolution?`, `snapshot?` |

All entities (except `Settings` and `ConflictLog`) carry `updatedAt: number` (Unix ms) and
`deletedAt?: number` for soft-delete and sync support.

\* **Derived / denormalized** — maintained by the data layer (`normalize.ts`, `aggregates.ts`),
excluded from conflict detection, and recomputed after every sync merge. Never write them from a
component.

`WorkoutStatus` is `'active' | 'finished' | 'deleted'`.

### Enums / Union Types

| Type           | Values                                                                 |
|----------------|------------------------------------------------------------------------|
| `MassUnit`     | `'kg'`, `'lb'`                                                         |
| `RPEType`      | `'rpe'`, `'rir'`                                                       |
| `MuscleGroup`  | `'chest'`, `'back'`, `'shoulders'`, `'legs'`, `'arms'`, `'core'`, `'full_body'`, `'cardio'`, `'other'` |
| `MovementType` | `'compound'`, `'isolation'`, `'isometric'`, `'cardio'`                 |

---

## Key Business Rules

- A workout is considered **finished** when `endedAt` is set.
- All fields of a finished workout are **fully editable** after completion.
- All changes are **immediately persisted** to IndexedDB — no "save" button.
- `useLiveQuery` (dexie-react-hooks) drives reactivity — changes appear instantly in the UI.
- Soft-delete pattern: records are marked with `deletedAt` rather than removed, for sync compatibility.
- **Last Write Wins (LWW)** by `updatedAt` timestamp is used during sync merges. Equal timestamps with
  divergent payloads are broken deterministically by content signature, so devices converge.
- **Layering is enforced by ESLint:** `src/components/**` and `src/hooks/**` must not import
  `src/db/db`. All persistence goes through `src/data/repositories`.
- **Never write `Date.now()` into a record.** Use `nowMonotonic()` (`src/data/clock.ts`) so a clock
  correction cannot make a fresh edit lose against an older remote row.
- **Derived fields are never authored by hand:** `status`, `workoutDay`, `setsCount`, `totalTonnage`,
  `exerciseCount`, and set-level `exerciseId`/`workoutId`/`performedAt` are produced by
  `src/data/normalize.ts` + `src/data/aggregates.ts`, and are excluded from conflict detection.
- Routing is done via `HashRouter` (no server-side routing needed for PWA/static hosting).

---

## Sync Architecture

The app uses a **Single File Snapshot** strategy for cloud sync:

1. **Pull** — download `strength-journal-snapshot.json` from Google Drive AppData folder (or load from a local JSON file).
2. **Merge** — index-batched: compare `updatedAt` per entity (LWW); equal timestamps + divergent
   payloads are resolved by content signature so both devices pick the same winner. Records are
   normalized on both sides before comparison, rows whose parent is missing are skipped and
   reported, and derived caches are recounted for every touched workout.
3. **Push** — upload the merged state back as a new snapshot.

### Sync Providers

| Provider              | File                    | Description                                      |
|-----------------------|-------------------------|--------------------------------------------------|
| `GoogleDriveProvider` | `GoogleDriveProvider.ts`| OAuth2 Google Drive REST API, AppData folder     |
| `FileSyncProvider`    | `FileProvider.ts`       | JSON export (file download) / import (file picker) |

Both implement the `SyncProvider` interface (`connect`, `disconnect`, `isAuthenticated`, `pull`, `push`).

The `SyncManager` class orchestrates the sync flow. It stores a unique `deviceId` in `localStorage`.  
Snapshot schema is versioned (`SCHEMA_VERSION = 3`). A supported *range* of older versions is
migrated forward; a snapshot from a newer app is rejected with an actionable message instead of
being merged blindly. Sync is serialised (in-process guard + `navigator.locks`), the snapshot is
read in a single transaction, and the conflict log is pruned after each sync.

No dedicated backend is required. Sync is manual (user-triggered).

---

## Database Schema (`src/db/db.ts`)

`AppDatabase` extends `Dexie`. Tables: `settings`, `exercises`, `workouts`, `workoutExercises`, `sets`, `conflictLog`, `workoutTemplates`.

The database has gone through **5 schema versions** (migrations run automatically):
- v1: Initial schema
- v2: Added `isCustom` index to `workoutTemplates`
- v3: Added `workoutDay` field + index to `workouts`
- v4: Added `variations` to exercises and `variation` to sets
- v5: Derived caches + indexes — `workouts.status`, `[status+startedAt]`, `[status+workoutDay]`,
  `workoutExercises.[workoutId+order]`, `sets.exerciseId`/`workoutId`/`[exerciseId+performedAt]`,
  plus `setsCount`/`totalTonnage`/`exerciseCount`. The upgrade backfills existing rows.

On first install (`populate` event) `seedDefaults()` inserts default settings, 16 exercises and 3
templates. `ensureCatalog()` (called from `main.tsx`) upserts built-ins for existing installs when
`settings.catalogVersion` is behind, so new default exercises reach old databases too.

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint (includes the UI/Dexie boundary rule)
npm run lint

# Typecheck
npx tsc -b

# Tests (Vitest + fake-indexeddb)
npm test
```

---

## Coding Conventions

- **All code, comments, and git commit messages must be in English.**
- Use `uuid` (v4) for all entity IDs — never rely on Dexie auto-increment IDs across devices.
- Prefer explicit, simple business logic over clever abstractions.
- Components are split by feature domain — keep them focused and scoped.
- Styling is **Tailwind CSS 4** with design tokens declared in `src/index.css` via `@theme`
  (`--color-bg-primary`, `--color-accent`, `--color-danger`, ...). There is no `variables.css`.
- Avoid new raw CSS; prefer utility classes (`flex`, `p-4`, `gap-2`) and the token-based colors
  (`bg-bg-secondary`, `text-text-tertiary`, `border-border`).
- Responsive classes (e.g., `sm:flex-row`, `sm:grid-cols-2`) are supported and preferred for mobile-first design.
- `useLiveQuery` is the primary pattern for reading reactive data from IndexedDB.
- All DB relationships use `uuid` as foreign keys (not auto-increment `id`) to ensure sync safety across devices.
- **Adding a feature:** types in `src/types`, pure rules in `src/domain`, persistence in
  `src/data/repositories/` (transactional, uuid-based), React glue in `src/hooks`, UI in
  `src/components`. Components/hooks must never import `src/db/db`.
- **Changing the schema:** add an append-only `version(n+1)` block whose `upgrade` uses
  `src/data/normalize.ts`; never edit a released `version(n)` block.
- **Changing the snapshot format:** add a migration to `SNAPSHOT_MIGRATIONS` in
  `src/services/sync/validateSnapshot.ts` (additive fields need none).
- Architecture reference and deferred work: `project_docs/ARCHITECTURE_REVIEW.md`.

---

## Environment Variables (Optional)

Create a `.env` file at the project root for Google Drive integration:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

If you use encrypted local agent secrets, generate it safely via:

```bash
scripts/agent-env > .env
```

---

## Planned Improvements (v1.1+)

- [ ] Incremental (delta) sync with tombstones + device registry (see ARCHITECTURE_REVIEW §6.1)
- [ ] Internationalisation (the `language` setting is persisted but unused)
- [ ] Dropbox / OneDrive sync adapters
- [ ] Server-based sync for real-time multi-device collaboration
- [ ] Social sharing features

---

## Local Agent Secrets and Google Browser Runtime

Agents must not ask for or print API keys, OAuth codes, cookies, passwords, or MFA values.

Use the machine-level helpers instead:

```bash
# Check whether secrets are unlocked and which redacted env files exist
agent-secrets status

# Generate this project's local .env from encrypted runtime secrets
ENV_OUTPUT=.env scripts/agent-env

# Prepare the technical Google account in FedotFox before live Drive/OAuth checks
agent-google-browser ensure --profile gmail-login
```

The expected encrypted env file path is:

```text
.config/agent-secrets/projects/sport-journal-web-app.env
```

For Google Drive sync verification, if `agent-google-browser ensure` reports missing/expired cookies or locked secrets, block the Kanban task and ask the human to run the refresh flow; do not retry headless OAuth indefinitely.
