import type { Exercise, SetEntry, Workout, WorkoutExercise, WorkoutTemplate } from '../types';
import { dayStringFromTimestamp, deriveStatus } from '../domain/workout';
import { nowMonotonic } from './clock';

/**
 * Single source of truth for derived/denormalized fields.
 *
 * Used by (a) DB schema upgrades and (b) the sync merge, so records produced by an older
 * client (or by a hand-edited JSON import) are repaired exactly the same way as new writes.
 * Pure functions — no Dexie access.
 */

function finiteOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeWorkout(workout: Workout): Workout {
    // Corrupt-row fallback (DB upgrade / hand-edited import). Must come from the monotonic
    // clock so LWW never regresses; evaluated lazily because this runs on every merged row.
    const startedAt = typeof workout.startedAt === 'number' && Number.isFinite(workout.startedAt)
        ? workout.startedAt
        : nowMonotonic();
    return {
        ...workout,
        startedAt,
        workoutDay: workout.workoutDay || dayStringFromTimestamp(startedAt),
        status: deriveStatus(workout),
    };
}

export type SetNormalizeContext = {
    workoutExercise?: Pick<WorkoutExercise, 'uuid' | 'exerciseId' | 'workoutId'>;
    workoutStartedAt?: number;
};

export function normalizeSet(set: SetEntry, context: SetNormalizeContext = {}): SetEntry {
    const next: SetEntry = { ...set };
    if (next.exerciseId == null && context.workoutExercise) {
        next.exerciseId = context.workoutExercise.exerciseId;
    }
    if (next.workoutId == null && context.workoutExercise) {
        next.workoutId = context.workoutExercise.workoutId;
    }
    if (next.performedAt == null && context.workoutStartedAt != null) {
        next.performedAt = context.workoutStartedAt;
    }
    return next;
}

export function normalizeExercise(exercise: Exercise): Exercise {
    return {
        ...exercise,
        aliases: Array.isArray(exercise.aliases) ? exercise.aliases : [],
        variations: Array.isArray(exercise.variations) ? exercise.variations : [],
        isCustom: typeof exercise.isCustom === 'boolean' ? exercise.isCustom : true,
    };
}

export function normalizeWorkoutExercise(workoutExercise: WorkoutExercise): WorkoutExercise {
    return {
        ...workoutExercise,
        order: finiteOr(workoutExercise.order, 0),
    };
}

export function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
    return {
        ...template,
        exercises: Array.isArray(template.exercises) ? template.exercises : [],
        isCustom: typeof template.isCustom === 'boolean' ? template.isCustom : true,
    };
}

/**
 * Fields that are derived caches rather than user intent.
 * They must never participate in conflict detection: two devices that agree on the
 * authored data would otherwise log a conflict on every sync.
 */
export const DERIVED_FIELDS = [
    'id',
    'updatedAt',
    // Device-local bookkeeping about which built-in catalog entries were already applied —
    // legitimately different per device, so it must not look like a user-visible conflict.
    'catalogVersion',
    'status',
    // Derived from `startedAt` in local time: two devices in different timezones derive
    // different day strings for the same legacy row, which must not read as divergence.
    'workoutDay',
    'setsCount',
    'totalTonnage',
    'exerciseCount',
    'exerciseId',
    'workoutId',
    'performedAt',
] as const;

const DERIVED_FIELD_SET = new Set<string>(DERIVED_FIELDS);

/** Stable, order-independent comparison of two records ignoring derived fields. */
export function contentSignature(record: Record<string, unknown>): string {
    const keys = Object.keys(record)
        .filter(key => !DERIVED_FIELD_SET.has(key) && record[key] !== undefined)
        .sort();
    return JSON.stringify(keys.map(key => [key, record[key]]));
}
