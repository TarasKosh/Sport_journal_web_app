# Strength Training Journal (PWA)

A robust, offline-first progressive web app for tracking strength training workouts. Built with React, TypeScript, and Dexie.js (IndexedDB).

## Features
- **Offline First**: All data stored locally in IndexedDB.
- **Workout Logging**: Quick set entry, RPE/RIR tracking, rest timer support.
- **History & Stats**: Visualize progress with 1RM estimates and volume charts.
- **Exercises**: Manage custom exercises and view history.
- **Synchronization**: 
    - Manual JSON Export/Import.
    - Google Drive Sync (Single file snapshot in AppData folder).
- **PWA**: Installable on mobile devices.

## Architecture

### Tech Stack
- **Framework**: Vite + React + TypeScript
- **Database**: Dexie.js (IndexedDB wrapper)
- **Styling**: Vanilla CSS with CSS Variables (Premium Dark Mode)
- **Icons**: Lucide React
- **Routing**: React Router DOM

### Project Structure
- `src/db`: Dexie database schema and configuration.
- `src/services/sync`: Sync engine logic (Snapshot generation, Three-way merge/Last-Write-Wins).
- `src/components`: UI Components split by feature (workouts, exercises, history).
- `src/types`: Shared TypeScript interfaces.

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

## Future Improvements (v1.1)
- [ ] Advanced graphs (Muscle distribution radar chart).
- [ ] Dropbox / OneDrive adapters.
- [ ] Server-based sync for real-time collaboration.
- [ ] Social sharing features.
