import type { SetEntry, Workout, WorkoutStatus } from '../types';

/** Finite number or 0 — guards against NaN/undefined leaking out of form inputs and snapshots. */
export function num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Tonnage contribution of a single set.
 * Matches the historical UI semantics: only sets with both weight and reps above zero count.
 */
export function tonnageOf(set: Pick<SetEntry, 'weight' | 'reps'>): number {
    const weight = num(set.weight);
    const reps = num(set.reps);
    return weight > 0 && reps > 0 ? weight * reps : 0;
}

export type WorkoutAggregates = {
    setsCount: number;
    totalTonnage: number;
};

/** Aggregates over an already filtered list of active sets. */
export function summarizeSets(sets: Array<Pick<SetEntry, 'weight' | 'reps'>>): WorkoutAggregates {
    let setsCount = 0;
    let totalTonnage = 0;
    for (const set of sets) {
        setsCount += 1;
        totalTonnage += tonnageOf(set);
    }
    return { setsCount, totalTonnage: Math.round(totalTonnage * 1000) / 1000 };
}

/** Next free `order` value for a collection of ordered siblings. */
export function nextOrder(records: Array<{ order?: number }>): number {
    let next = 0;
    for (const record of records) {
        const order = typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : -1;
        if (order + 1 > next) next = order + 1;
    }
    return next;
}

/** Lifecycle status derived from timestamps — soft-delete wins over finished. */
export function deriveStatus(workout: Pick<Workout, 'endedAt' | 'deletedAt'>): WorkoutStatus {
    if (workout.deletedAt != null) return 'deleted';
    if (workout.endedAt != null) return 'finished';
    return 'active';
}

/** Local `YYYY-MM-DD` day string for a timestamp. */
export function dayStringFromTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Duration in whole minutes, or null when the workout is not finished. */
export function durationMinutes(workout: Pick<Workout, 'startedAt' | 'endedAt'>): number | null {
    if (workout.endedAt == null || workout.startedAt == null) return null;
    return Math.round((workout.endedAt - workout.startedAt) / 1000 / 60);
}
