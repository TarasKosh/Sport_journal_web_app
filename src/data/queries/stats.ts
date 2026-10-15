import Dexie from 'dexie';
import { db } from '../../db/db';
import type { Exercise, SetEntry, Workout, WorkoutExercise } from '../../types';
import type { StatsPeriod } from '../../services/stats';
import { onlyActive } from '../../utils/entityFilters';
import { fetchByAnyOf } from './anyOf';

export type StatsInput = {
    workouts: Workout[];
    workoutExercises: WorkoutExercise[];
    sets: SetEntry[];
    exercises: Exercise[];
};

/**
 * Lower bound of a stats period, mirroring `filterWorkoutsByPeriod` in the stats service.
 * `null` means "from the beginning".
 */
export function periodStart(period: StatsPeriod): number | null {
    if (period === 'all') return null;

    const now = new Date();
    const start = new Date();
    switch (period) {
        case 'week': start.setDate(now.getDate() - 7); break;
        case 'month': start.setMonth(now.getMonth() - 1); break;
        case '3months': start.setMonth(now.getMonth() - 3); break;
        case '6months': start.setMonth(now.getMonth() - 6); break;
        case 'year': start.setFullYear(now.getFullYear() - 1); break;
    }
    return start.getTime();
}

/**
 * Loads exactly the rows a period needs.
 *
 * Before: `db.workouts.toArray()` + `db.exercises.toArray()` + `anyOf` over every workout id.
 * Now: one range scan on [status+startedAt], then chunked lookups, and only the exercises
 * actually referenced by the period are loaded.
 */
export async function loadStatsInput(period: StatsPeriod): Promise<StatsInput> {
    const start = periodStart(period);
    const workoutRange = db.workouts.where('[status+startedAt]');
    const workouts = start == null
        ? await workoutRange.between(['finished', Dexie.minKey], ['finished', Dexie.maxKey]).toArray()
        : await workoutRange.between(['finished', start], ['finished', Dexie.maxKey]).toArray();

    if (workouts.length === 0) {
        return { workouts, workoutExercises: [], sets: [], exercises: [] };
    }

    const workoutUuids = workouts.map(workout => workout.uuid);
    const workoutExercises = onlyActive(
        await fetchByAnyOf<WorkoutExercise>(
            keys => db.workoutExercises.where('workoutId').anyOf(keys),
            workoutUuids,
        ),
    );

    const workoutExerciseUuids = workoutExercises.map(row => row.uuid);
    const sets = workoutExerciseUuids.length === 0
        ? []
        : onlyActive(
            await fetchByAnyOf<SetEntry>(
                keys => db.sets.where('workoutExerciseId').anyOf(keys),
                workoutExerciseUuids,
            ),
        );

    const exerciseUuids = workoutExercises.map(row => row.exerciseId);
    const exercises = await fetchByAnyOf<Exercise>(
        keys => db.exercises.where('uuid').anyOf(keys),
        exerciseUuids,
    );

    return { workouts, workoutExercises, sets, exercises };
}
