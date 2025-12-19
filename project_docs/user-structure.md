# User Flow & Project Structure: Sport Journal Web App

## User Journey
1. User opens app and is greeted with workout logging or today’s plan
2. User starts and completes a workout, adding exercises/sets/notes as desired
3. Workout is automatically saved with all entered details
4. User can visit the 'History' page to see a list of completed workouts
5. User clicks the edit icon/button on any past workout to open EditWorkoutModal and change details (title, notes, mood, date, etc.)

## Data Flow
- All workout edits and additions go through Dexie/IndexedDB and React state sync
- Editing finished workout updates both DB and displayed history immediately

## Project File Structure
project_docs/
    overview.md
    requirements.md
    tech-specs.md
    user-structure.md
    timeline.md
src/
    components/
        common/
            Button.tsx
            Card.tsx
            Input.tsx
        history/
            HistoryList.tsx
        workouts/
            ActiveWorkoutView.tsx
            EditWorkoutModal.tsx
            WorkoutPage.tsx
            WorkoutDayPickerModal.tsx
        ...
    types/
        index.ts
    db/
        db.ts

