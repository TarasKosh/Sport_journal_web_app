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
| Styling      | Tailwind-like Utility CSS (Mini-Framework) + CSS Variables |
| Icons        | Lucide React                                           |
| Routing      | React Router DOM v7 (HashRouter)                       |
| Utilities    | date-fns v4 (date formatting), clsx (class merging), uuid v13 |
| Sync         | Google Drive REST API (optional) + local JSON Export/Import |
| Build/Dev    | Vite 7, vite-plugin-pwa                                |
| Linting      | ESLint 9 + typescript-eslint                           |

---

## Project Structure

```
src/
├── App.tsx                 # Root component, routing setup (HashRouter)
├── App.css                 # App-level CSS overrides
├── main.tsx                # Entry point
├── index.css               # Global CSS variables, dark theme, layout
├── db/
│   └── db.ts               # Dexie database class (AppDatabase), schema versions 1–4, seed data
├── types/
│   └── index.ts            # Shared TypeScript interfaces and enums
├── hooks/
│   └── useDebounce.ts      # Debounce utility hook
├── services/
│   └── sync/               # Sync engine
│       ├── SyncManager.ts  # Pull → Merge (LWW) → Push orchestration
│       ├── GoogleDriveProvider.ts  # Google Drive REST API provider
│       ├── FileProvider.ts         # Local JSON Export/Import provider
│       └── types.ts        # SyncSnapshot, SyncProvider, SyncStatus interfaces
├── styles/                 # Additional CSS modules
├── assets/                 # Static assets (icons, images)
└── components/
    ├── common/             # Reusable UI primitives: Button, Card, Input
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
| `Workout`          | `uuid`, `startedAt`, `endedAt`, `workoutDay`, `title?`, `tags?`, `mood?`, `bodyWeight?`, `notes?` |
| `Exercise`         | `uuid`, `name`, `muscleGroup`, `movementType?`, `equipment?`, `aliases?`, `variations?`, `isCustom`, `notes?`, `isUnilateral?` |
| `WorkoutExercise`  | `uuid`, `workoutId`, `exerciseId`, `order`, `notes?`                       |
| `SetEntry`         | `uuid`, `workoutExerciseId`, `order`, `weight`, `reps`, `variation?`, `rpe?`, `rir?`, `restSec?`, `isWarmup`, `isFailure`, `failureRep?`, `side?`, `notes?` |
| `WorkoutTemplate`  | `uuid`, `name`, `description?`, `exercises` (array of exercise UUIDs), `isCustom` |
| `Settings`         | `massUnit` (kg/lb), `weightStep`, `defaultRPEType`, `theme` (dark/light/system), `language` |
| `ConflictLog`      | `uuid`, `entityType`, `entityId`, `localUpdatedAt`, `remoteUpdatedAt`, `resolvedAt?`, `resolution?`, `snapshot?` |

All entities (except `Settings` and `ConflictLog`) carry `updatedAt: number` (Unix ms) and `deletedAt?: number` for soft-delete and sync support.

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
- **Last Write Wins (LWW)** by `updatedAt` timestamp is used during sync merges.
- Routing is done via `HashRouter` (no server-side routing needed for PWA/static hosting).

---

## Sync Architecture

The app uses a **Single File Snapshot** strategy for cloud sync:

1. **Pull** — download `strength-journal-snapshot.json` from Google Drive AppData folder (or load from a local JSON file).
2. **Merge** — compare `updatedAt` for each entity; the newer record wins (LWW). New records are added, deletedAt preserves soft-delete state.
3. **Push** — upload the merged state back as a new snapshot.

### Sync Providers

| Provider              | File                    | Description                                      |
|-----------------------|-------------------------|--------------------------------------------------|
| `GoogleDriveProvider` | `GoogleDriveProvider.ts`| OAuth2 Google Drive REST API, AppData folder     |
| `FileSyncProvider`    | `FileProvider.ts`       | JSON export (file download) / import (file picker) |

Both implement the `SyncProvider` interface (`connect`, `disconnect`, `isAuthenticated`, `pull`, `push`).

The `SyncManager` class orchestrates the sync flow. It stores a unique `deviceId` in `localStorage`.  
Snapshot schema is versioned (`SCHEMA_VERSION = 3`); version mismatch throws an error.

No dedicated backend is required. Sync is manual (user-triggered).

---

## Database Schema (`src/db/db.ts`)

`AppDatabase` extends `Dexie`. Tables: `settings`, `exercises`, `workouts`, `workoutExercises`, `sets`, `conflictLog`, `workoutTemplates`.

The database has gone through **4 schema versions** (migrations run automatically):
- v1: Initial schema
- v2: Added `isCustom` index to `workoutTemplates`
- v3: Added `workoutDay` field + index to `workouts`
- v4: Added `variations` to exercises and `variation` to sets

On first install (`populate` event), `seedData()` inserts default settings, 16 exercises, and 3 workout templates.

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

# Lint
npm run lint
```

---

## Coding Conventions

- **All code, comments, and git commit messages must be in English.**
- Use `uuid` (v4) for all entity IDs — never rely on Dexie auto-increment IDs across devices.
- Prefer explicit, simple business logic over clever abstractions.
- Components are split by feature domain — keep them focused and scoped.
- Styling uses a custom "Tailwind-like" utility system defined in `src/index.css`. 
- Avoid writing new raw CSS for layouts; prefer existing utility classes (e.g., `flex`, `p-4`, `gap-2`).
- Responsive classes (e.g., `sm:flex-row`, `sm:grid-cols-2`) are supported and preferred for mobile-first design.
- Use CSS Custom Properties (variables) from `variables.css` for colors, spacing, and radii.
- `useLiveQuery` is the primary pattern for reading reactive data from IndexedDB.
- All DB relationships use `uuid` as foreign keys (not auto-increment `id`) to ensure sync safety across devices.

---

## Environment Variables (Optional)

Create a `.env` file at the project root for Google Drive integration:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

---

## Planned Improvements (v1.1+)

- [ ] Dropbox / OneDrive sync adapters
- [ ] Server-based sync for real-time multi-device collaboration
- [ ] Social sharing features
