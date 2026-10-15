import { db } from '../db/db';

/**
 * Resets the in-memory (fake-indexeddb) database between tests.
 * `delete()` + `open()` re-triggers `populate`, so the seed rows are cleared afterwards.
 */
export async function resetTestDatabase(): Promise<void> {
    await db.delete();
    await db.open();
    await Promise.all([
        db.settings.clear(),
        db.exercises.clear(),
        db.workouts.clear(),
        db.workoutExercises.clear(),
        db.sets.clear(),
        db.workoutTemplates.clear(),
        db.conflictLog.clear(),
    ]);
}
