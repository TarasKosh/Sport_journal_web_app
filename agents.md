# Agents Guide — Sport Journal Web App

This file provides context and instructions for AI agents (coding assistants, LLMs, etc.) working on this project.

---

## Project Summary

**Strength Training Journal** is an offline-first Progressive Web App (PWA) for logging and analyzing strength training workouts. All data is stored locally in the browser's IndexedDB via Dexie.js. An optional Google Drive sync provides cloud backup via a single-file snapshot strategy.

---

## Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Framework    | Vite 7 + React 19 + TypeScript                      |
| Database     | Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks  |
| Styling      | Vanilla CSS with CSS Variables (Dark Mode)          |
| Icons        | Lucide React                                        |
| Routing      | React Router DOM v7                                 |
| Utilities    | date-fns (date formatting), clsx (class merging)    |
| Sync         | Google Drive REST API (optional)                    |
| Build/Dev    | Vite 7, vite-plugin-pwa                             |
| Linting      | ESLint 9 + typescript-eslint                        |

---

## Project Structure

```
src/
├── App.tsx                 # Root component, routing setup
├── main.tsx                # Entry point
├── index.css               # Global CSS variables, dark theme, layout
├── db/                     # Dexie database schema and initialization
├── types/                  # Shared TypeScript interfaces (Workout, Exercise, SetEntry, etc.)
├── hooks/                  # Custom React hooks (e.g., useLiveQuery wrappers)
├── services/               # Business logic
│   └── sync/               # Sync engine: snapshot generation, three-way merge (LWW)
├── styles/                 # Additional CSS modules
├── assets/                 # Static assets (icons, images)
└── components/
    ├── common/             # Reusable UI primitives (buttons, modals, inputs)
    ├── layout/             # App shell, navigation
    ├── workouts/           # Active workout session components
    ├── history/            # Completed workout history and editing
    ├── exercises/          # Exercise library, picker, and detail views
    ├── stats/              # Statistics page: tonnage over time (line chart), muscle distribution over time (stacked area + multi-line charts), body weight trend, 1RM estimates
    ├── settings/           # User preferences (mass unit, theme, RPE type, language)
    └── sync/               # Google Drive sync UI
```

---

## Core Domain Models (`src/types/index.ts`)

| Interface          | Key Fields                                                                 |
|--------------------|----------------------------------------------------------------------------|
| `Workout`          | `uuid`, `startedAt`, `endedAt`, `workoutDay`, `title`, `mood`, `bodyWeight`, `notes` |
| `Exercise`         | `uuid`, `name`, `muscleGroup`, `movementType`, `equipment`, `isCustom`    |
| `WorkoutExercise`  | `uuid`, `workoutId`, `exerciseId`, `order`                                 |
| `SetEntry`         | `uuid`, `workoutExerciseId`, `weight`, `reps`, `rpe`, `rir`, `isWarmup`, `isFailure` |
| `WorkoutTemplate`  | `uuid`, `name`, `exercises` (array of exercise UUIDs)                     |
| `Settings`         | `massUnit` (kg/lb), `weightStep`, `defaultRPEType`, `theme`, `language`   |

All entities carry `updatedAt: number` (Unix ms) and `deletedAt?: number` for soft-delete and sync support.

---

## Key Business Rules

- A workout is considered **finished** when `endedAt` is set.
- All fields of a finished workout are **fully editable** after completion.
- All changes are **immediately persisted** to IndexedDB — no "save" button.
- `useLiveQuery` (dexie-react-hooks) drives reactivity — changes appear instantly in the UI.
- Soft-delete pattern: records are marked with `deletedAt` rather than removed, for sync compatibility.
- **Last Write Wins (LWW)** by `updatedAt` timestamp is used during sync merges.

---

## Sync Architecture

The app uses a **Single File Snapshot** strategy for cloud sync:

1. **Pull** — download `strength-journal-snapshot.json` from Google Drive AppData folder.
2. **Merge** — compare `updatedAt` for each entity; the newer record wins (LWW).
3. **Push** — upload the merged state back as a new snapshot.

No dedicated backend is required. Sync is manual (user-triggered).

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

---

## Coding Conventions

- **All code, comments, and git commit messages must be in English.**
- Use `uuid` (v4) for all entity IDs — never rely on Dexie auto-increment IDs across devices.
- Prefer explicit, simple business logic over clever abstractions.
- Components are split by feature domain — keep them focused and scoped.
- CSS is written in Vanilla CSS using CSS Custom Properties (variables). No Tailwind.
- TypeScript strict mode is enabled — avoid `any` except in documented edge cases (e.g., sync snapshots).
- `useLiveQuery` is the primary pattern for reading reactive data from IndexedDB.

---

## Environment Variables (Optional)

Create a `.env` file at the project root for Google Drive integration:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

---

## Planned Improvements (v1.1+)

- [ ] Muscle distribution radar chart
- [ ] Dropbox / OneDrive sync adapters
- [ ] Server-based sync for real-time multi-device collaboration
- [ ] Social sharing features
