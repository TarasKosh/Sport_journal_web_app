# Requirements & Features

## System Requirements
- Modern browser (Edge, Chrome, FireFox, Safari)
- Desktop & Mobile friendly UI
- Data persistence in browser (IndexedDB/Dexie)

## Feature List
- Logging workouts with exercises, sets, and notes
- History view of all completed workouts
- Full editing of finished workouts:
  - Metadata: title, notes, mood, body weight, workout date
  - Exercises: add, remove, reorder exercises
  - Sets: add, remove, edit sets
  - Set content: edit weight, reps, RPE, variations, failure status, and all other set parameters
- Quick search and filtering by dates or keywords

## Business Rules
- Workouts are considered "finished" if they have an endedAt timestamp
- Users may freely edit all core fields of any workout after completion
- All changes are instantly saved in the local database

## Edge Cases
- If workoutDay date is changed, it must not overlap with another unfinished workout
- Mood and notes fields are optional
- BodyWeight field accepts only valid numeric input

