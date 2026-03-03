# Strength Training Journal (PWA)

A robust, offline-first progressive web app for tracking strength training workouts. Built with React, TypeScript, and Dexie.js (IndexedDB).

## Features
- **Offline First**: All data stored locally in IndexedDB.
- **Workout Logging**: Quick set entry, RPE/RIR tracking, rest timer support.
- **History & Stats**: Visualize progress with tonnage over time, muscle distribution over time (stacked area + multi-line charts), body weight trend, and 1RM estimates.
- **Exercises**: Manage custom exercises and view history per exercise.
- **Synchronization**:
    - Manual JSON Export/Import.
    - Google Drive Sync (single-file snapshot in AppData folder).
- **PWA**: Installable on mobile and desktop devices.

## Architecture

### Tech Stack
- **Framework**: Vite 7 + React 19 + TypeScript
- **Database**: Dexie.js 4 (IndexedDB wrapper) + dexie-react-hooks
- **Styling**: Vanilla CSS with CSS Variables (Premium Dark Mode)
- **Icons**: Lucide React
- **Routing**: React Router DOM v7
- **Utilities**: date-fns (date formatting), clsx (class merging)

### Project Structure
```
src/
├── db/              # Dexie database schema and initialization
├── types/           # Shared TypeScript interfaces (Workout, Exercise, SetEntry, …)
├── hooks/           # Custom React hooks
├── services/sync/   # Sync engine (snapshot generation, Last-Write-Wins merge)
├── styles/          # Additional CSS
└── components/
    ├── common/      # Reusable UI primitives (Card, modals, inputs)
    ├── layout/      # App shell and navigation
    ├── workouts/    # Active workout session
    ├── history/     # Completed workout history and editing
    ├── exercises/   # Exercise library and picker
    ├── stats/       # Statistics page with charts
    ├── settings/    # User preferences
    └── sync/        # Google Drive sync UI
```

### Synchronization Protocol
The app uses a "Single File Snapshot" approach for simplicity and robustness without a dedicated backend.
1. **Pull**: Downloads `strength-journal-snapshot.json` from Cloud.
2. **Merge**: Compares `updatedAt` timestamps for every entity (Last Write Wins). 
3. **Push**: Uploads the merged state back to Cloud.

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

## Configuration
Create a `.env` file for Google Drive Sync (Optional):
```
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_API_KEY=your_api_key
```

## Testing
- Unit Tests: `npm run test` (Vitest)
- E2E Tests: `npx playwright test`

## Future Improvements (v1.1+)
- [ ] Dropbox / OneDrive sync adapters.
- [ ] Server-based sync for real-time multi-device collaboration.
- [ ] Social sharing features.
- [ ] Muscle distribution radar chart.
