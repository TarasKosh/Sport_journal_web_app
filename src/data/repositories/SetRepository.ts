import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { SetEntry } from '../../types';
import { nextOrder, tonnageOf } from '../../domain/workout';
import { onlyActive } from '../../utils/entityFilters';
import { nowMonotonic } from '../clock';
import { applyAggregateDelta, recountWorkout } from '../aggregates';

export type NewSetInput = {
    weight?: number;
    reps?: number;
    rpe?: number;
    rir?: number;
    variation?: string;
    side?: 'left' | 'right';
    isWarmup?: boolean;
    isFailure?: boolean;
};

/** How many recent sets the indexed "last performance" lookup inspects. */
const LAST_PERFORMANCE_SCAN = 30;

/**
 * Fallback for rows written before v5 denormalization (e.g. imported from an older
 * client), where `exerciseId`/`performedAt` are absent and therefore not indexed.
 */
async function lastPerformanceLegacy(
    exerciseUuid: string,
    excludeWorkoutExerciseUuid?: string,
): Promise<SetEntry | null> {
    const workoutExercises = onlyActive(
        await db.workoutExercises.where('exerciseId').equals(exerciseUuid).toArray(),
    ).filter(row => row.uuid !== excludeWorkoutExerciseUuid);
    if (workoutExercises.length === 0) return null;

    const workoutIds = [...new Set(workoutExercises.map(row => row.workoutId))];
    const workouts = await db.workouts.where('uuid').anyOf(workoutIds).toArray();
    const startedAtByWorkout = new Map(workouts.map(workout => [workout.uuid, workout.startedAt]));
    const byUuid = new Map(workoutExercises.map(row => [row.uuid, row]));

    const sets = onlyActive(
        await db.sets.where('workoutExerciseId').anyOf([...byUuid.keys()]).toArray(),
    );

    const ordered = sets
        .map(set => {
            const parent = byUuid.get(set.workoutExerciseId);
            const performedAt = set.performedAt ?? (parent ? startedAtByWorkout.get(parent.workoutId) ?? 0 : 0);
            return { set, performedAt };
        })
        .sort((a, b) => b.performedAt - a.performedAt || (b.set.order ?? 0) - (a.set.order ?? 0));

    return ordered[0]?.set ?? null;
}

/**
 * All set reads/writes, including the workout aggregate cache and the denormalized
 * `exerciseId`/`workoutId`/`performedAt` keys used for indexed lookups.
 *
 * Multi-step writes run in a transaction: computing `order` outside one allowed two rapid
 * taps to produce the same order value, and a swap that crashed midway left duplicates.
 */
/** Legacy join path for rows that predate v5 denormalization (no `exerciseId`). */
async function recentByExerciseLegacy(exerciseUuid: string, limit: number): Promise<SetEntry[]> {
    const workoutExercises = onlyActive(
        await db.workoutExercises.where('exerciseId').equals(exerciseUuid).toArray(),
    );
    if (workoutExercises.length === 0) return [];

    const byUuid = new Map(workoutExercises.map(row => [row.uuid, row]));
    const workouts = await db.workouts
        .where('uuid')
        .anyOf([...new Set(workoutExercises.map(row => row.workoutId))])
        .toArray();
    const startedAtByWorkout = new Map(workouts.map(workout => [workout.uuid, workout.startedAt]));

    const sets = onlyActive(
        await db.sets.where('workoutExerciseId').anyOf([...byUuid.keys()]).toArray(),
    );

    return sets
        .map(set => {
            const parent = byUuid.get(set.workoutExerciseId);
            const performedAt = set.performedAt ?? (parent ? startedAtByWorkout.get(parent.workoutId) ?? 0 : 0);
            return { ...set, performedAt };
        })
        .sort((a, b) => (a.performedAt ?? 0) - (b.performedAt ?? 0) || a.order - b.order)
        .slice(-limit);
}

export const SetRepository = {
    async listByWorkoutExercise(workoutExerciseUuid: string): Promise<SetEntry[]> {
        const rows = onlyActive(
            await db.sets.where('workoutExerciseId').equals(workoutExerciseUuid).toArray(),
        );
        return rows.sort((a, b) => a.order - b.order);
    },

    async listByWorkout(workoutUuid: string): Promise<SetEntry[]> {
        const rows = onlyActive(await db.sets.where('workoutId').equals(workoutUuid).toArray());
        return rows.sort((a, b) => a.order - b.order);
    },

    async listByWorkoutExercises(workoutExerciseUuids: string[]): Promise<SetEntry[]> {
        if (workoutExerciseUuids.length === 0) return [];
        const rows = onlyActive(await db.sets.where('workoutExerciseId').anyOf(workoutExerciseUuids).toArray());
        return rows.sort((a, b) => a.order - b.order);
    },

    async get(id: number): Promise<SetEntry | undefined> {
        return db.sets.get(id);
    },

    async add(workoutExerciseUuid: string, input: NewSetInput = {}): Promise<SetEntry> {
        return db.transaction('rw', [db.sets, db.workoutExercises, db.workouts], async () => {
            const workoutExercise = await db.workoutExercises
                .where('uuid')
                .equals(workoutExerciseUuid)
                .first();
            if (!workoutExercise) {
                throw new Error(`Unknown workout exercise: ${workoutExerciseUuid}`);
            }
            const workout = await db.workouts.where('uuid').equals(workoutExercise.workoutId).first();
            const siblings = onlyActive(
                await db.sets.where('workoutExerciseId').equals(workoutExerciseUuid).toArray(),
            );

            const entry: SetEntry = {
                uuid: uuidv4(),
                workoutExerciseId: workoutExerciseUuid,
                exerciseId: workoutExercise.exerciseId,
                workoutId: workoutExercise.workoutId,
                performedAt: workout?.startedAt,
                order: nextOrder(siblings),
                weight: input.weight ?? 0,
                reps: input.reps ?? 0,
                variation: input.variation,
                rpe: input.rpe,
                rir: input.rir,
                side: input.side,
                isWarmup: input.isWarmup ?? false,
                isFailure: input.isFailure ?? false,
                updatedAt: nowMonotonic(),
            };

            const id = await db.sets.add(entry);
            await applyAggregateDelta(workoutExercise.workoutId, {
                setsCount: 1,
                totalTonnage: tonnageOf(entry),
            });
            return { ...entry, id };
        });
    },

    /**
     * Patches a set, keeping the parent workout's aggregate cache in sync.
     * When the patch moves the set to a different workout exercise, the denormalized keys
     * (`exerciseId`/`workoutId`/`performedAt`) are re-derived from the new parent and BOTH
     * workouts are recounted (the old one loses the set, the new one gains it).
     */
    async update(id: number, patch: Partial<SetEntry>): Promise<void> {
        await db.transaction('rw', [db.sets, db.workoutExercises, db.workouts], async () => {
            const before = await db.sets.get(id);
            if (!before) return;

            const targetUuid = patch.workoutExerciseId;
            const movesParent = targetUuid !== undefined && targetUuid !== before.workoutExerciseId;

            let after: SetEntry;
            if (movesParent) {
                const newParent = await db.workoutExercises
                    .where('uuid')
                    .equals(targetUuid)
                    .first();
                if (!newParent) {
                    throw new Error(`Unknown workout exercise: ${targetUuid}`);
                }
                const newWorkout = await db.workouts.where('uuid').equals(newParent.workoutId).first();
                const siblings = onlyActive(
                    await db.sets.where('workoutExerciseId').equals(newParent.uuid).toArray(),
                );
                after = {
                    ...before,
                    ...patch,
                    exerciseId: newParent.exerciseId,
                    workoutId: newParent.workoutId,
                    performedAt: newWorkout?.startedAt,
                    order: patch.order ?? nextOrder(siblings),
                    updatedAt: nowMonotonic(),
                };
                await db.sets.put(after);
                if (before.workoutId && before.workoutId !== newParent.workoutId) {
                    await recountWorkout(before.workoutId);
                }
                await recountWorkout(newParent.workoutId);
            } else {
                after = { ...before, ...patch, updatedAt: nowMonotonic() };
                await db.sets.put(after);

                const delta = tonnageOf(after) - tonnageOf(before);
                if (delta !== 0 && after.workoutId) {
                    await applyAggregateDelta(after.workoutId, { totalTonnage: delta });
                }
            }
        });
    },

    async softDelete(id: number): Promise<void> {
        await db.transaction('rw', [db.sets, db.workouts], async () => {
            const entry = await db.sets.get(id);
            if (!entry || entry.deletedAt != null) return;
            const now = nowMonotonic();
            await db.sets.update(id, { deletedAt: now, updatedAt: now });
            if (entry.workoutId) {
                await applyAggregateDelta(entry.workoutId, {
                    setsCount: -1,
                    totalTonnage: -tonnageOf(entry),
                });
            }
        });
    },

    /**
     * Most recent logged sets for an exercise (progress chart / quick history).
     * Uses the denormalized `exerciseId` index, so it reads a bounded window instead of
     * every workout plus one join query per workout. Falls back to the legacy join when the
     * window cannot fill the page — either it holds rows written before denormalization
     * (imported from an older client) or soft-deleted rows crowd it and older active data
     * lives beyond the window.
     */
    async recentByExercise(exerciseUuid: string, limit = 20): Promise<SetEntry[]> {
        const candidates = await db.sets
            .where('[exerciseId+performedAt]')
            .between([exerciseUuid, Dexie.minKey], [exerciseUuid, Dexie.maxKey])
            .reverse()
            .limit(limit * 3)
            .toArray();

        const active = candidates
            .filter(set => set.deletedAt == null)
            .sort((a, b) => (a.performedAt ?? 0) - (b.performedAt ?? 0));
        if (active.length >= limit) return active.slice(-limit);

        return recentByExerciseLegacy(exerciseUuid, limit);
    },

    /**
     * Most recent logged set for an exercise, used to prefill a new set.
     * Ordered by the *workout date* (`performedAt`), not by `updatedAt`: editing an old
     * workout used to promote it to "latest" and prefill the wrong weight.
     */
    async lastPerformance(
        exerciseUuid: string,
        options: { excludeWorkoutExerciseUuid?: string } = {},
    ): Promise<SetEntry | null> {
        const candidates = await db.sets
            .where('[exerciseId+performedAt]')
            .between([exerciseUuid, Dexie.minKey], [exerciseUuid, Dexie.maxKey])
            .reverse()
            .limit(LAST_PERFORMANCE_SCAN)
            .toArray();

        const indexed = candidates.find(
            set =>
                set.deletedAt == null &&
                set.workoutExerciseId !== options.excludeWorkoutExerciseUuid,
        );
        if (indexed) return indexed;

        return lastPerformanceLegacy(exerciseUuid, options.excludeWorkoutExerciseUuid);
    },

    lastPerformanceLegacy,
};
