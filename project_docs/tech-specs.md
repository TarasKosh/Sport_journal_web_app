# Technical Specifications: Sport Journal Web App

## Tech Stack
- React (with hooks)
- TypeScript
- Dexie.js (IndexedDB wrapper)
- TailwindCSS / Custom Styles

## Development Methods
- Feature-driven components, easy to extend and refactor
- Split UI (components/common, components/workouts, etc.)
- Automated linter checks (ESLint)

## Coding Standards
- Type-safe entities (Workout, SetEntry, WorkoutExercise, etc.)
- All code and comments in English
- Modular: Every core entity (Workout, Exercise, Set) is its own interface and DB table
- Prefer simple, explicit business logic

## Database Design
- IndexedDB, relational links by UUID
- workouts table: stores finished and ongoing workouts
  - finished workout: endedAt assigned
- All fields editable after creation (title, notes, mood, date, etc.)

## Editing Logic
- EditWorkoutModal component used for editing finished workouts
- db.workouts.update called for all changes (React state sync)
- Edits are visible instantly in the UI (HistoryList)

