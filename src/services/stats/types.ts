export interface MuscleDistribution {
    name: string;
    volume: number;
    topExercises: { name: string; volume: number }[];
}

export interface MuscleWeekData {
    week: string;
    muscles: Record<string, number>;
}

export interface StatsData {
    totalWorkouts: number;
    totalTonnage: number;
    totalSets: number;
    totalReps: number;
    avgWorkoutsPerWeek: number;
    thisWeekCount: number;
    muscleDistribution: MuscleDistribution[];
    workoutsOverTime: { week: string; count: number }[];
    tonnageOverTime: { week: string; tonnage: number }[];
    muscleDistributionOverTime: MuscleWeekData[];
    prCount: number;
    bodyWeightOverTime: { week: string; weight: number }[];
}

export type StatsPeriod = 'week' | 'month' | '3months' | '6months' | 'year' | 'all';
