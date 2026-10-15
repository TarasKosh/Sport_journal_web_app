import { useLiveQuery } from 'dexie-react-hooks';
import type { StatsData, StatsPeriod } from '../services/stats';
import { loadStatsInput } from '../data/queries/stats';
import { toDayString } from '../utils/dateUtils';
import { safeNum } from '../utils';
import {
    calculateAvgWorkoutsPerWeek,
    calculateMuscleDistribution,
    calculateWorkoutsOverTime,
    calculateTonnageOverTime,
    calculateBodyWeightOverTime,
    calculateMuscleDistributionOverTime,
    calculatePRs,
} from '../services/stats';

export function useStats(period: StatsPeriod): StatsData | null {
    return useLiveQuery<StatsData | null>(async () => {
        try {
            // Rows are loaded by index for the requested period only: a range scan on
            // [status+startedAt], chunked lookups for the joins, and just the referenced
            // exercises — instead of pulling every table into memory.
            const { workouts, workoutExercises, sets, exercises } = await loadStatsInput(period);

            const totalWorkouts = workouts.length;
            const totalSets = sets.length;
            const totalReps = sets.reduce((acc, s) => acc + safeNum(s.reps), 0);
            const totalTonnage = sets.reduce((acc, s) => acc + safeNum(s.weight) * safeNum(s.reps), 0);
            const avgWorkoutsPerWeek = calculateAvgWorkoutsPerWeek(workouts, period);

            // This week count (the period never excludes the current week)
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const thisWeekWorkouts = workouts.filter(w => w.workoutDay >= toDayString(startOfWeek));

            return {
                totalWorkouts,
                totalTonnage,
                totalSets,
                totalReps,
                avgWorkoutsPerWeek,
                thisWeekCount: thisWeekWorkouts.length,
                muscleDistribution: calculateMuscleDistribution(sets, workoutExercises, exercises),
                workoutsOverTime: calculateWorkoutsOverTime(workouts),
                tonnageOverTime: calculateTonnageOverTime(sets, workoutExercises, workouts),
                muscleDistributionOverTime: calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises),
                prCount: calculatePRs(sets, workoutExercises),
                bodyWeightOverTime: calculateBodyWeightOverTime(workouts),
            };
        } catch (e) {
            console.error('Stats query failed', e);
            return null;
        }
    }, [period]) ?? null;
}
