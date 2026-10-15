import type { Workout } from '../types';
import { db } from '../db/db';
import { onlyActive } from '../utils/entityFilters';
import { summarizeSets } from '../domain/workout';

/**
 * Workout aggregates (`setsCount`, `totalTonnage`, `exerciseCount`) are a derived cache.
 *
 * Why they exist: without them every history card had to run its own live query for the
 * workout's sets and recompute tonnage in JS (N+1 subscriptions, one per rendered card).
 * The cache is only ever written here, and never bumps `updatedAt`, so it stays out of
 * the sync conflict surface.
 *
 * These helpers rely on an *ambient* Dexie transaction: callers must include
 * `db.workouts`, `db.workoutExercises` and `db.sets` in the transaction scope.
 */

export type AggregateDelta = {
    setsCount?: number;
    totalTonnage?: number;
    exerciseCount?: number;
};

export async function applyAggregateDelta(workoutUuid: string, delta: AggregateDelta): Promise<void> {
    await db.workouts
        .where('uuid')
        .equals(workoutUuid)
        .modify((workout: Workout) => {
            if (delta.setsCount) workout.setsCount = Math.max(0, (workout.setsCount ?? 0) + delta.setsCount);
            if (delta.totalTonnage) {
                const next = (workout.totalTonnage ?? 0) + delta.totalTonnage;
                workout.totalTonnage = next > 0 ? next : 0;
            }
            if (delta.exerciseCount) {
                workout.exerciseCount = Math.max(0, (workout.exerciseCount ?? 0) + delta.exerciseCount);
            }
        });
}

/** Recomputes aggregates for one workout from its current rows. */
export async function recountWorkout(workoutUuid: string): Promise<void> {
    const workoutExercises = onlyActive(
        await db.workoutExercises.where('workoutId').equals(workoutUuid).toArray(),
    );
    const workoutExerciseUuids = workoutExercises.map(workoutExercise => workoutExercise.uuid);
    const sets = workoutExerciseUuids.length === 0
        ? []
        : onlyActive(await db.sets.where('workoutExerciseId').anyOf(workoutExerciseUuids).toArray());

    const { setsCount, totalTonnage } = summarizeSets(sets);

    await db.workouts
        .where('uuid')
        .equals(workoutUuid)
        .modify((workout: Workout) => {
            workout.setsCount = setsCount;
            workout.totalTonnage = totalTonnage;
            workout.exerciseCount = workoutExercises.length;
        });
}

/** Recomputes aggregates for a set of workouts (deduplicated, sequential). */
export async function recountWorkouts(workoutUuids: Iterable<string>): Promise<void> {
    for (const workoutUuid of new Set(workoutUuids)) {
        await recountWorkout(workoutUuid);
    }
}
