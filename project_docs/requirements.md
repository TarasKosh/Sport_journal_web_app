# Requirements & Features

## System Requirements
- Modern browser (Edge, Chrome, FireFox, Safari)
- Desktop & Mobile friendly UI
- Data persistence in browser (IndexedDB/Dexie)

## Feature List
- Logging workouts with exercises, sets, and notes
- History view of all completed workouts
- Edit any finished workout: title, notes, mood, body weight, workout date
- Quick search and filtering by dates or keywords

## Business Rules
- Workouts are considered "finished" if they have an endedAt timestamp
- Users may freely edit all core fields of any workout after completion
- All changes are instantly saved in the local database

## Edge Cases
- If workoutDay date is changed, it must not overlap with another unfinished workout
- Mood and notes fields are optional
- BodyWeight field accepts only valid numeric input

