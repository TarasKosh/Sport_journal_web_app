import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { StatsData, StatsPeriod } from '../services/stats';
import { toDayString } from '../utils/dateUtils';
import {
    filterWorkoutsByPeriod,
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
        const workouts = await db.workouts.toArray();
        const exercises = await db.exercises.toArray();

        const completedWorkouts = workouts.filter(w => !!w.endedAt);
        const filteredWorkouts = filterWorkoutsByPeriod(completedWorkouts, period);

        const workoutIds = filteredWorkouts.map(w => w.uuid);
        const workoutExercises = await db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray();
        const workoutExerciseIds = workoutExercises.map(we => we.uuid);
        const filteredSets = await db.sets.where('workoutExerciseId').anyOf(workoutExerciseIds).toArray();

        const totalWorkouts = filteredWorkouts.length;
        const totalSets = filteredSets.length;
        const totalReps = filteredSets.reduce((acc, s) => acc + s.reps, 0);
        const totalTonnage = filteredSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
        const avgWorkoutsPerWeek = calculateAvgWorkoutsPerWeek(filteredWorkouts, period);

        // This week count
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const thisWeekWorkouts = completedWorkouts.filter(w => w.workoutDay >= toDayString(startOfWeek));

        return {
            totalWorkouts,
            totalTonnage,
            totalSets,
            totalReps,
            avgWorkoutsPerWeek,
            thisWeekCount: thisWeekWorkouts.length,
            muscleDistribution: calculateMuscleDistribution(filteredSets, workoutExercises, exercises),
            workoutsOverTime: calculateWorkoutsOverTime(filteredWorkouts),
            tonnageOverTime: calculateTonnageOverTime(filteredSets, workoutExercises, filteredWorkouts),
            muscleDistributionOverTime: calculateMuscleDistributionOverTime(filteredSets, workoutExercises, filteredWorkouts, exercises),
            prCount: calculatePRs(filteredSets, workoutExercises),
            bodyWeightOverTime: calculateBodyWeightOverTime(filteredWorkouts),
        };
    }, [period]) ?? null;
}
