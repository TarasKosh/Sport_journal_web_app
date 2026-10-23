# Strength Training Journal (PWA)

A robust, offline-first Progressive Web App for tracking strength training workouts. Built with React 19, TypeScript, and Dexie.js (IndexedDB). No backend required.

## Features

- **Offline First**: All data stored locally in IndexedDB (Dexie.js). Works without internet.
- **Workout Logging**: Quick set entry with weight, reps, RPE/RIR tracking, warmup/failure flags, and rest timer support.
- **Templates**: Create and use workout templates to start sessions faster.
- **History & Editing**: Browse (paginated) and fully edit all past workouts after completion.
- **Statistics**: Visualize progress — tonnage over time, muscle distribution over time (stacked area + multi-line charts), body weight trend, and 1RM estimates.
- **Exercise Library**: Built-in exercises with muscle group, movement type, and equipment info. Add custom exercises.
- **Synchronization**:
  - Manual JSON Export/Import (works offline, no account needed).
  - Google Drive Sync (single-file snapshot in AppData folder, optional).
- **Settings**: Configure mass unit (kg/lb), weight step, RPE/RIR preference, and theme.
- **PWA**: Installable on mobile and desktop devices.

## Architecture

The app is layered so that persistence logic lives in exactly one place. The full review, including findings, the target design and the deliberately deferred work, is in [project_docs/ARCHITECTURE_REVIEW.md](project_docs/ARCHITECTURE_REVIEW.md).

```
UI (components, hooks)  ──►  data/repositories  ──►  Dexie  ──►  IndexedDB
                                    ▲
                     sync (snapshot merge) · stats (pure calculations)
```

**Invariant enforced by ESLint:** `src/components/**` and `src/hooks/**` may not import `src/db/db`. All reads/writes go through a repository, which stamps `updatedAt` with a monotonic clock and keeps derived fields consistent inside a transaction.

### Tech Stack

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Framework   | Vite 7 + React 19 + TypeScript                          |
| Database    | Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks      |
| Styling     | Tailwind CSS 4 (`@theme` design tokens in `src/index.css`) |
| Icons       | Lucide React                                            |
| Routing     | React Router DOM v7 (HashRouter, lazy routes)           |
| Utilities   | clsx, uuid v13                                          |
| Build       | Vite 7 + vite-plugin-pwa                                |
| Testing     | Vitest 4 + Testing Library + fake-indexeddb             |
| Linting     | ESLint 9 + typescript-eslint                            |

### Project Structure

```
src/
├── App.tsx                  # Routing (HashRouter) + error boundary + lazy routes
├── index.css                # Tailwind import + design tokens
├── domain/                  # Pure rules: tonnage, ordering, status, day keys
├── data/
│   ├── repositories/        # The only code that reads/writes tables (uuid APIs)
│   ├── queries/             # Chunked anyOf helper, period-bounded stats loader
│   ├── aggregates.ts        # Derived workout cache (setsCount/totalTonnage/exerciseCount)
│   ├── normalize.ts         # Derived/denormalized repair shared by upgrades and sync
│   ├── clock.ts             # Monotonic write timestamps (LWW safety)
│   └── seed.ts              # Built-in catalog + idempotent upsert
├── db/db.ts                 # Dexie schema (v1-v5), migrations, populate wiring
├── types/index.ts           # Shared domain interfaces
├── hooks/                   # useSettings, useWorkoutEditor, useExerciseIndex, useStats, ...
├── services/
│   ├── sync/                # Pull -> merge (LWW + tie-break) -> push, snapshot validation
│   └── stats/               # Pure statistics calculations
├── test-utils/              # Shared test database reset
└── components/
    ├── common/              # Button, Card, Input, ModalShell, ConfirmDialog, ErrorBoundary
    ├── layout/              # App shell and navigation
    ├── workouts/            # Active session, set entry, edit modal, pickers
    ├── history/             # Paginated history, workout details
    ├── exercises/           # Library and templates
    ├── stats/               # Charts and metrics
    ├── settings/            # Preferences + danger zone
    └── sync/                # Google Drive + JSON export/import + conflicts
```

### Database schema

Schema versions are append-only (`db/db.ts`): v1 initial, v2 template `isCustom`, v3 `workoutDay`, v4 exercise `variations`, **v5 derived caches + indexes** — `workouts.status`, `[status+startedAt]`, `[status+workoutDay]`, `workoutExercises.[workoutId+order]`, `sets.exerciseId`/`workoutId`/`[exerciseId+performedAt]`, plus the aggregate cache (`setsCount`, `totalTonnage`, `exerciseCount`). The v5 upgrade backfills existing rows.

### Synchronization Protocol

The app uses a **Single File Snapshot** approach — no dedicated backend needed.

1. **Pull**: Downloads `strength-journal-snapshot.json` from Google Drive (or loads a local JSON file).
2. **Merge**: indexed, batched merge. Last Write Wins by `updatedAt`; when timestamps are equal and payloads differ, a content-based tie-break decides deterministically so both devices converge. Soft-deletes propagate through `deletedAt`. Rows whose parent is missing are skipped and reported. Derived caches are recomputed for every touched workout.
3. **Push**: Uploads the merged state back as a new snapshot.

Sync is **manual** (user-triggered), serialised (in-process guard + `navigator.locks`), and the snapshot is read inside one transaction. Snapshot `schemaVersion` accepts a supported range with a forward-migration chain; a snapshot from a newer app is rejected with an actionable message. A unique `deviceId` is stored in `localStorage`, and the conflict log (surfaced read-only in Settings ▸ Synchronization) is pruned after each sync.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Preview Production Build**
   ```bash
   npm run preview
   ```

## Testing & Checks

```bash
npm run lint     # includes the UI/Dexie boundary rule
npx tsc -b       # typecheck (strict)
npm test         # Vitest + fake-indexeddb
npm run build    # production build + PWA service worker
```

CI runs lint, `tsc -b` and `npm test` on every push (see `.github/workflows/ci.yml`).

## Configuration

Create a local `.env` file at the project root to enable Google Drive Sync (optional).
On this machine, agents should prefer generating it from encrypted runtime secrets:

```bash
ENV_OUTPUT=.env scripts/agent-env
```

That script materializes the expected secret path:

```text
.config/agent-secrets/projects/sport-journal-web-app.env
```

Do not commit `.env`, OAuth tokens, or browser/session state.

Manual fallback:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id
```

Without a client ID, only the local JSON Export/Import sync is available.

## Future Improvements (v1.1+)

- [ ] Incremental (delta) sync with tombstones and a device registry ([design sketch](project_docs/ARCHITECTURE_REVIEW.md#61-incremental-delta-sync)).
- [ ] Internationalisation (the `language` setting exists but is unused).
- [ ] Dropbox / OneDrive sync adapters.
- [ ] Server-based sync for real-time multi-device collaboration.
- [ ] Social sharing features.
