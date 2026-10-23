import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { WorkoutExercise } from '../../types';
import { nextOrder } from '../../domain/workout';
import { onlyActive } from '../../utils/entityFilters';
import { nowMonotonic } from '../clock';
import { recountWorkout } from '../aggregates';
import { softDeleteWorkoutExerciseAndReorder } from '../../services/data/softDelete';

/**
 * Exercises inside a workout (the join rows) plus their ordering.
 *
 * `[workoutId+order]` gives the ordered list straight from the index — the previous code
 * fetched by workoutId and re-sorted in JS on every live-query tick.
 */
async function listByWorkout(workoutUuid: string): Promise<WorkoutExercise[]> {
    const rows = await db.workoutExercises
        .where('[workoutId+order]')
        .between([workoutUuid, Dexie.minKey], [workoutUuid, Dexie.maxKey])
        .toArray();
    return rows.filter(row => row.deletedAt == null);
}

export const WorkoutExerciseRepository = {
    listByWorkout,

    async getByUuid(uuid: string): Promise<WorkoutExercise | undefined> {
        return db.workoutExercises.where('uuid').equals(uuid).first();
    },

    async add(workoutUuid: string, exerciseUuid: string): Promise<void> {
        await db.transaction('rw', [db.workoutExercises, db.workouts], async () => {
            const workout = await db.workouts.where('uuid').equals(workoutUuid).first();
            if (!workout) {
                throw new Error(`Unknown workout: ${workoutUuid}`);
            }
            const siblings = onlyActive(
                await db.workoutExercises.where('workoutId').equals(workoutUuid).toArray(),
            );
            await db.workoutExercises.add({
                uuid: uuidv4(),
                workoutId: workoutUuid,
                exerciseId: exerciseUuid,
                order: nextOrder(siblings),
                updatedAt: nowMonotonic(),
            });
            await db.workouts.where('uuid').equals(workoutUuid).modify(workout => {
                workout.exerciseCount = siblings.length + 1;
            });
        });
    },

    /** Appends a template's exercises atomically, preserving template order. */
    async addMany(workoutUuid: string, exerciseUuids: string[]): Promise<void> {
        if (exerciseUuids.length === 0) return;
        await db.transaction('rw', [db.workoutExercises, db.workouts], async () => {
            const workout = await db.workouts.where('uuid').equals(workoutUuid).first();
            if (!workout) {
                throw new Error(`Unknown workout: ${workoutUuid}`);
            }
            const siblings = onlyActive(
                await db.workoutExercises.where('workoutId').equals(workoutUuid).toArray(),
            );
            const start = nextOrder(siblings);
            const now = nowMonotonic();
            await db.workoutExercises.bulkAdd(
                exerciseUuids.map((exerciseUuid, offset) => ({
                    uuid: uuidv4(),
                    workoutId: workoutUuid,
                    exerciseId: exerciseUuid,
                    order: start + offset,
                    updatedAt: now,
                })),
            );
            await db.workouts.where('uuid').equals(workoutUuid).modify(workout => {
                workout.exerciseCount = siblings.length + exerciseUuids.length;
            });
        });
    },

    /** Swaps a row with its neighbour in a single transaction (no duplicate orders). */
    async move(workoutExerciseUuid: string, direction: 'up' | 'down'): Promise<void> {
        await db.transaction('rw', db.workoutExercises, async () => {
            const current = await db.workoutExercises.where('uuid').equals(workoutExerciseUuid).first();
            if (!current || current.id == null) return;

            const siblings = await listByWorkout(current.workoutId);
            const position = siblings.findIndex(row => row.uuid === workoutExerciseUuid);
            const targetPosition = direction === 'up' ? position - 1 : position + 1;
            if (position < 0 || targetPosition < 0 || targetPosition >= siblings.length) return;

            const neighbour = siblings[targetPosition];
            if (neighbour?.id == null) return;

            const now = nowMonotonic();
            await db.workoutExercises.update(current.id, { order: targetPosition, updatedAt: now });
            await db.workoutExercises.update(neighbour.id, { order: position, updatedAt: now });
        });
    },

    /**
     * Soft-deletes the row and its sets, reorders the rest, then recounts the workout.
     * Everything runs in ONE transaction: the delete helper opens a sub-transaction over
     * a subset of this scope, so a crash between delete and recount can no longer leave
     * the aggregate cache (setsCount/totalTonnage/exerciseCount) stale.
     * The recount (rather than a hand-computed delta) keeps the cache correct even if a
     * previous write was interrupted.
     */
    async remove(workoutExerciseUuid: string): Promise<void> {
        await db.transaction('rw', [db.sets, db.workoutExercises, db.workouts], async () => {
            const row = await db.workoutExercises.where('uuid').equals(workoutExerciseUuid).first();
            if (!row || row.id == null) return;
            await softDeleteWorkoutExerciseAndReorder(row.id, row.workoutId);
            await recountWorkout(row.workoutId);
        });
    },
};
