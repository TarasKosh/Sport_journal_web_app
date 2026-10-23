import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { Workout } from '../../types';
import { dayStringFromTimestamp } from '../../domain/workout';
import { normalizeWorkout } from '../normalize';
import { nowMonotonic } from '../clock';
import { softDeleteWorkout } from '../../services/data/softDelete';

/** Body-weight lookback window when resolving the last logged body weight. */
const BODY_WEIGHT_SCAN_LIMIT = 200;

/**
 * All workout reads/writes. The UI never touches IndexedDB directly.
 *
 * Every query below hits an index: `status` replaces the old `.filter(w => !w.endedAt)`
 * full-table scan, and the compound `[status+startedAt]` / `[status+workoutDay]` indexes
 * provide range + ordering in one pass.
 */
export const WorkoutRepository = {
    async getActive(): Promise<Workout | undefined> {
        const active = await db.workouts.where('status').equals('active').toArray();
        return active.find(workout => workout.deletedAt == null);
    },

    async getByUuid(uuid: string): Promise<Workout | undefined> {
        return db.workouts.where('uuid').equals(uuid).first();
    },

    async listActive(): Promise<Workout[]> {
        const active = await db.workouts.where('status').equals('active').toArray();
        return active.filter(workout => workout.deletedAt == null);
    },

    /** Finished workouts, newest day first. */
    async listFinishedPage(offset: number, limit: number): Promise<Workout[]> {
        return db.workouts
            .where('[status+workoutDay]')
            .between(['finished', Dexie.minKey], ['finished', Dexie.maxKey])
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
    },

    async countFinished(): Promise<number> {
        return db.workouts.where('status').equals('finished').count();
    },

    async listFinishedByDay(workoutDay: string): Promise<Workout[]> {
        return db.workouts.where('[status+workoutDay]').equals(['finished', workoutDay]).toArray();
    },

    /** Last logged body weight (kg) among finished workouts, newest first. */
    async lastBodyWeightKg(): Promise<number | null> {
        const recent = await db.workouts
            .where('[status+startedAt]')
            .between(['finished', Dexie.minKey], ['finished', Dexie.maxKey])
            .reverse()
            .limit(BODY_WEIGHT_SCAN_LIMIT)
            .toArray();
        const withWeight = recent.find(workout => workout.bodyWeight != null);
        return withWeight?.bodyWeight ?? null;
    },

    async start(input: { workoutDay?: string; bodyWeightKg?: number } = {}): Promise<Workout> {
        const now = nowMonotonic();
        const workout: Workout = {
            uuid: uuidv4(),
            startedAt: now,
            workoutDay: input.workoutDay || dayStringFromTimestamp(now),
            bodyWeight: input.bodyWeightKg,
            status: 'active',
            setsCount: 0,
            totalTonnage: 0,
            exerciseCount: 0,
            updatedAt: now,
        };
        await db.workouts.add(workout);
        return workout;
    },

    /**
     * Finishes an active workout. A soft-deleted workout is left untouched (returning
     * `false` from the modify callback skips the write) — writing `status: 'finished'`
     * unconditionally used to resurrect it into every history/stats query.
     */
    async finish(uuid: string): Promise<boolean> {
        const now = nowMonotonic();
        let finished = false;
        await db.workouts.where('uuid').equals(uuid).modify((workout: Workout) => {
            if (workout.deletedAt != null) return false;
            workout.endedAt = now;
            workout.status = 'finished';
            workout.updatedAt = now;
            finished = true;
        });
        return finished;
    },

    /** Patches user-authored metadata; derived fields are recomputed by `normalizeWorkout`. */
    async updateMetadata(uuid: string, patch: Partial<Workout>): Promise<void> {
        await db.transaction('rw', db.workouts, async () => {
            const existing = await db.workouts.where('uuid').equals(uuid).first();
            if (!existing) return;
            const merged = normalizeWorkout({ ...existing, ...patch, updatedAt: nowMonotonic() });
            await db.workouts.put(merged);
        });
    },

    async softDelete(uuid: string): Promise<void> {
        const workout = await db.workouts.where('uuid').equals(uuid).first();
        if (!workout || workout.id == null) return;
        await softDeleteWorkout(workout.id);
    },
};
