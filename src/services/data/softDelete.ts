import type { Table } from 'dexie';
import { db } from '../../db/db';
import { onlyActive } from '../../utils/entityFilters';
import { nowMonotonic } from '../../data/clock';

type IdRecord = { id?: number; uuid: string; deletedAt?: number; updatedAt: number };

async function softDeleteRows<T extends IdRecord>(
    table: Table<T, number>,
    rows: T[],
    now: number,
): Promise<void> {
    for (const row of rows) {
        if (row.id == null || row.deletedAt != null) continue;
        await table.update(
            row.id,
            { deletedAt: now, updatedAt: now } as unknown as Parameters<Table<T, number>['update']>[1],
        );
    }
}

/** Soft-delete a single set by local id */
export async function softDeleteSet(setId: number): Promise<void> {
    const now = nowMonotonic();
    await db.sets.update(setId, { deletedAt: now, updatedAt: now });
}

/** Soft-delete a workout exercise and all its sets */
export async function softDeleteWorkoutExercise(workoutExerciseId: number): Promise<void> {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt != null) return;

    const now = nowMonotonic();
    await db.transaction('rw', [db.sets, db.workoutExercises], async () => {
        const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
        await softDeleteRows(db.sets, sets, now);
        await db.workoutExercises.update(workoutExerciseId, { deletedAt: now, updatedAt: now });
    });
}

/**
 * Soft-delete a workout and cascade to workoutExercises + sets.
 */
export async function softDeleteWorkout(workoutId: number): Promise<void> {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt != null) return;

    const now = nowMonotonic();
    await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
        const workoutExercises = await db.workoutExercises
            .where('workoutId')
            .equals(workout.uuid)
            .toArray();

        for (const we of workoutExercises) {
            if (we.deletedAt != null) continue;
            const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
            await softDeleteRows(db.sets, sets, now);
            if (we.id != null) {
                await db.workoutExercises.update(we.id, { deletedAt: now, updatedAt: now });
            }
        }

        // `status` keeps deleted rows out of every indexed query.
        await db.workouts.update(workoutId, { deletedAt: now, status: 'deleted', updatedAt: now });
    });
}

/**
 * Soft-delete exercise from library.
 * Only custom exercises may be deleted; built-in seeds are protected.
 */
export async function softDeleteExercise(exerciseId: number): Promise<void> {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise || exercise.deletedAt != null) return;
    if (!exercise.isCustom) {
        throw new Error('Built-in exercises cannot be deleted.');
    }
    const now = nowMonotonic();
    await db.exercises.update(exerciseId, { deletedAt: now, updatedAt: now });
}

/** Soft-delete workout template (custom only) */
export async function softDeleteWorkoutTemplate(templateId: number): Promise<void> {
    const template = await db.workoutTemplates.get(templateId);
    if (!template || template.deletedAt != null) return;
    if (!template.isCustom) {
        throw new Error('Built-in templates cannot be deleted.');
    }
    const now = nowMonotonic();
    await db.workoutTemplates.update(templateId, { deletedAt: now, updatedAt: now });
}

/**
 * Soft-delete a workout exercise by local id, cascade sets, then reorder remaining active siblings.
 * Delete + reorder run in a single transaction.
 */
export async function softDeleteWorkoutExerciseAndReorder(
    workoutExerciseId: number,
    workoutId: string,
): Promise<void> {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt != null) return;

    const now = nowMonotonic();
    await db.transaction('rw', [db.sets, db.workoutExercises], async () => {
        const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
        await softDeleteRows(db.sets, sets, now);
        await db.workoutExercises.update(workoutExerciseId, { deletedAt: now, updatedAt: now });

        const remaining = onlyActive(
            await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
        ).sort((a, b) => a.order - b.order);

        for (let i = 0; i < remaining.length; i++) {
            if (remaining[i].id != null && remaining[i].order !== i) {
                await db.workoutExercises.update(remaining[i].id!, { order: i, updatedAt: now });
            }
        }
    });
}
