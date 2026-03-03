# Strength Training Journal (PWA)

A robust, offline-first Progressive Web App for tracking strength training workouts. Built with React 19, TypeScript, and Dexie.js (IndexedDB). No backend required.

## Features

- **Offline First**: All data stored locally in IndexedDB (Dexie.js). Works without internet.
- **Workout Logging**: Quick set entry with weight, reps, RPE/RIR tracking, warmup/failure flags, and rest timer support.
- **Templates**: Create and use workout templates to start sessions faster.
- **History & Editing**: Browse and fully edit all past workouts after completion.
- **Statistics**: Visualize progress — tonnage over time, muscle distribution over time (stacked area + multi-line charts), body weight trend, and 1RM estimates.
- **Exercise Library**: Built-in exercises with muscle group, movement type, and equipment info. Add custom exercises.
- **Synchronization**:
  - Manual JSON Export/Import (works offline, no account needed).
  - Google Drive Sync (single-file snapshot in AppData folder, optional).
- **Settings**: Configure mass unit (kg/lb), weight step, RPE/RIR preference, language, and theme.
- **PWA**: Installable on mobile and desktop devices.

## Architecture

### Tech Stack

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Framework   | Vite 7 + React 19 + TypeScript                          |
| Database    | Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks      |
| Styling     | Vanilla CSS with CSS Variables (Premium Dark Mode)      |
| Icons       | Lucide React                                            |
| Routing     | React Router DOM v7 (HashRouter)                        |
| Utilities   | date-fns v4, clsx, uuid v13                             |
| Build       | Vite 7 + vite-plugin-pwa                                |
| Linting     | ESLint 9 + typescript-eslint                            |

### Project Structure

```
src/
├── App.tsx              # Root component, routing (HashRouter)
├── index.css            # Global CSS variables, dark theme
├── db/db.ts             # Dexie database (AppDatabase), 4 schema versions, seed data
├── types/index.ts       # Shared TypeScript interfaces and enums
├── hooks/               # Custom React hooks (useDebounce)
├── services/sync/       # Sync engine:
│   ├── SyncManager.ts       # Pull → Merge (LWW) → Push
│   ├── GoogleDriveProvider.ts
│   ├── FileProvider.ts      # JSON Export/Import
│   └── types.ts             # SyncSnapshot, SyncProvider interfaces
└── components/
    ├── common/          # Reusable UI primitives (Button, Card, Input)
    ├── layout/          # App shell and navigation
    ├── workouts/        # Active workout session
    ├── history/         # Completed workout history and editing
    ├── exercises/       # Exercise library, picker, templates
    ├── stats/           # Statistics page with charts
    ├── settings/        # User preferences
    └── sync/            # Sync UI (Google Drive + JSON export/import)
```

### Synchronization Protocol

The app uses a **Single File Snapshot** approach — no dedicated backend needed.

1. **Pull**: Downloads `strength-journal-snapshot.json` from Google Drive (or loads a local JSON file).
2. **Merge**: Compares `updatedAt` timestamps for every entity — Last Write Wins (LWW). Soft-deletes (`deletedAt`) are preserved.
3. **Push**: Uploads the merged state back as a new snapshot.

Sync is **manual** (user-triggered). A unique `deviceId` is stored in `localStorage`.

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

## Configuration

Create a `.env` file at the project root to enable Google Drive Sync (optional):

```env
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_API_KEY=your_api_key
```

Without these variables, only the local JSON Export/Import sync is available.

## Future Improvements (v1.1+)

- [ ] Dropbox / OneDrive sync adapters.
- [ ] Server-based sync for real-time multi-device collaboration.
- [ ] Social sharing features.
