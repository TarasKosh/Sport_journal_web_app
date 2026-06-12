import type { Workout, SetEntry, Exercise, WorkoutExercise } from '../../types';
import type { MuscleDistribution, MuscleWeekData } from './types';

/** Get the Monday-based week key for a timestamp */
function getWeekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

/** Filter workouts to only those within the given period */
export function filterWorkoutsByPeriod(workouts: Workout[], period: string): Workout[] {
    if (period === 'all') return workouts;

    const now = new Date();
    const startDate = new Date();

    switch (period) {
        case 'week':     startDate.setDate(now.getDate() - 7); break;
        case 'month':    startDate.setMonth(now.getMonth() - 1); break;
        case '3months':  startDate.setMonth(now.getMonth() - 3); break;
        case '6months':  startDate.setMonth(now.getMonth() - 6); break;
        case 'year':     startDate.setFullYear(now.getFullYear() - 1); break;
        default:         return workouts;
    }

    const startTimestamp = startDate.getTime();
    return workouts.filter(w => (w.startedAt || 0) >= startTimestamp);
}

/** Calculate average workouts per week for the given period */
export function calculateAvgWorkoutsPerWeek(workouts: Workout[], period: string): number {
    if (workouts.length === 0) return 0;

    let weeks = 1;
    switch (period) {
        case 'week':    weeks = 1; break;
        case 'month':   weeks = 4; break;
        case '3months': weeks = 12; break;
        case '6months': weeks = 24; break;
        case 'year':    weeks = 52; break;
        case 'all':
            if (workouts.length > 0) {
                const firstDate = new Date(Math.min(...workouts.map(w => w.startedAt || 0)));
                const diffTime = Math.abs(Date.now() - firstDate.getTime());
                weeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
            }
            break;
    }

    return workouts.length / weeks;
}

/** Calculate volume distribution across muscle groups */
export function calculateMuscleDistribution(
    sets: SetEntry[],
    workoutExercises: WorkoutExercise[],
    exercises: Exercise[]
): MuscleDistribution[] {
    const exerciseMap: Record<string, Exercise> = {};
    exercises.forEach(e => { exerciseMap[e.uuid] = e; });

    const muscleGroups: Record<string, { volume: number; exercises: Record<string, number> }> = {};

    sets.forEach(set => {
        const we = workoutExercises.find(w => w.uuid === set.workoutExerciseId);
        if (!we) return;
        const exercise = exerciseMap[we.exerciseId];
        if (!exercise) return;

        const volume = set.weight * set.reps;
        const mg = exercise.muscleGroup;

        if (!muscleGroups[mg]) muscleGroups[mg] = { volume: 0, exercises: {} };
        muscleGroups[mg].volume += volume;
        muscleGroups[mg].exercises[exercise.name] = (muscleGroups[mg].exercises[exercise.name] || 0) + volume;
    });

    return Object.entries(muscleGroups)
        .map(([name, data]) => ({
            name,
            volume: data.volume,
            topExercises: Object.entries(data.exercises)
                .map(([n, v]) => ({ name: n, volume: v }))
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 5)
        }))
        .sort((a, b) => b.volume - a.volume);
}

/** Calculate weekly workout counts */
export function calculateWorkoutsOverTime(workouts: Workout[]): { week: string; count: number }[] {
    const weeklyData: Record<string, number> = {};

    workouts.forEach(w => {
        if (w.startedAt) {
            const key = getWeekKey(w.startedAt);
            weeklyData[key] = (weeklyData[key] || 0) + 1;
        }
    });

    return Object.entries(weeklyData)
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => {
            const [yA, mA, dA] = a.week.split('-').map(Number);
            const [yB, mB, dB] = b.week.split('-').map(Number);
            return new Date(yA, mA, dA).getTime() - new Date(yB, mB, dB).getTime();
        });
}

/** Calculate weekly tonnage (weight × reps) */
export function calculateTonnageOverTime(
    sets: SetEntry[],
    workoutExercises: WorkoutExercise[],
    workouts: Workout[]
): { week: string; tonnage: number }[] {
    const weToWorkout: Record<string, string> = {};
    workoutExercises.forEach(we => { weToWorkout[we.uuid] = we.workoutId; });

    const workoutStart: Record<string, number> = {};
    workouts.forEach(w => { workoutStart[w.uuid] = w.startedAt || 0; });

    const weeklyData: Record<string, number> = {};

    sets.forEach(set => {
        const workoutId = weToWorkout[set.workoutExerciseId];
        const startedAt = workoutId ? workoutStart[workoutId] : undefined;
        if (!startedAt) return;

        const key = getWeekKey(startedAt);
        weeklyData[key] = (weeklyData[key] || 0) + set.weight * set.reps;
    });

    return Object.entries(weeklyData)
        .map(([week, tonnage]) => ({ week, tonnage }))
        .sort((a, b) => {
            const [yA, mA, dA] = a.week.split('-').map(Number);
            const [yB, mB, dB] = b.week.split('-').map(Number);
            return new Date(yA, mA, dA).getTime() - new Date(yB, mB, dB).getTime();
        });
}

/** Calculate body weight data points (one per workout) */
export function calculateBodyWeightOverTime(workouts: Workout[]): { week: string; weight: number }[] {
    return workouts
        .filter(w => w.startedAt && w.bodyWeight && w.bodyWeight > 0 && w.bodyWeight < 500)
        .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
        .map(w => {
            const label = new Date(w.startedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return { week: label, weight: w.bodyWeight! };
        });
}

/** Calculate weekly muscle group volume breakdown */
export function calculateMuscleDistributionOverTime(
    sets: SetEntry[],
    workoutExercises: WorkoutExercise[],
    workouts: Workout[],
    exercises: Exercise[]
): MuscleWeekData[] {
    const exerciseMap: Record<string, Exercise> = {};
    exercises.forEach(e => { exerciseMap[e.uuid] = e; });

    const weToWorkoutId: Record<string, string> = {};
    const weToExerciseId: Record<string, string> = {};
    workoutExercises.forEach(we => {
        weToWorkoutId[we.uuid] = we.workoutId;
        weToExerciseId[we.uuid] = we.exerciseId;
    });

    const workoutStartMap: Record<string, number> = {};
    workouts.forEach(w => { workoutStartMap[w.uuid] = w.startedAt || 0; });

    const weeklyMuscles: Record<string, Record<string, number>> = {};

    sets.forEach(set => {
        const workoutId = weToWorkoutId[set.workoutExerciseId];
        const exerciseId = weToExerciseId[set.workoutExerciseId];
        if (!workoutId || !exerciseId) return;

        const startedAt = workoutStartMap[workoutId];
        if (!startedAt) return;

        const exercise = exerciseMap[exerciseId];
        if (!exercise) return;

        const key = getWeekKey(startedAt);
        if (!weeklyMuscles[key]) weeklyMuscles[key] = {};
        weeklyMuscles[key][exercise.muscleGroup] = (weeklyMuscles[key][exercise.muscleGroup] || 0) + set.weight * set.reps;
    });

    return Object.entries(weeklyMuscles)
        .map(([week, muscles]) => ({ week, muscles }))
        .sort((a, b) => {
            const [yA, mA, dA] = a.week.split('-').map(Number);
            const [yB, mB, dB] = b.week.split('-').map(Number);
            return new Date(yA, mA, dA).getTime() - new Date(yB, mB, dB).getTime();
        });
}

/** Count exercises that have at least one set (simple PR metric) */
export function calculatePRs(sets: SetEntry[], workoutExercises: WorkoutExercise[]): number {
    const exerciseSetMap: Record<string, boolean> = {};

    sets.forEach(set => {
        const we = workoutExercises.find(w => w.uuid === set.workoutExerciseId);
        if (we) exerciseSetMap[we.exerciseId] = true;
    });

    return Object.keys(exerciseSetMap).length;
}
