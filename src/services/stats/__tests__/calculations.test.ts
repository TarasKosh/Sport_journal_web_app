import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  filterWorkoutsByPeriod,
  calculateAvgWorkoutsPerWeek,
  calculateMuscleDistribution,
  calculateWorkoutsOverTime,
  calculateTonnageOverTime,
  calculateBodyWeightOverTime,
  calculateMuscleDistributionOverTime,
  calculatePRs,
} from '../calculations';
import type { Workout, WorkoutExercise, Exercise, SetEntry } from '../../../types';

function makeWorkout(overrides: Partial<{
  uuid: string;
  startedAt: number;
  endedAt: number;
  workoutDay: string;
  bodyWeight: number;
  updatedAt: number;
}> = {}): Workout {
  return {
    uuid: overrides.uuid ?? 'w-1',
    startedAt: overrides.startedAt ?? Date.now(),
    endedAt: overrides.endedAt,
    workoutDay: overrides.workoutDay ?? 'Monday',
    bodyWeight: overrides.bodyWeight,
    updatedAt: overrides.updatedAt ?? Date.now(),
  } as Workout;
}

function makeWorkoutExercise(overrides: Partial<{
  uuid: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  updatedAt: number;
}> = {}): WorkoutExercise {
  return {
    uuid: overrides.uuid ?? 'we-1',
    workoutId: overrides.workoutId ?? 'w-1',
    exerciseId: overrides.exerciseId ?? 'ex-1',
    order: overrides.order ?? 1,
    updatedAt: overrides.updatedAt ?? Date.now(),
  } as WorkoutExercise;
}

function makeExercise(overrides: Partial<{
  uuid: string;
  name: string;
  muscleGroup: string;
  isCustom: boolean;
  updatedAt: number;
}> = {}): Exercise {
  return {
    uuid: overrides.uuid ?? 'ex-1',
    name: overrides.name ?? 'Bench Press',
    muscleGroup: overrides.muscleGroup ?? 'chest',
    isCustom: overrides.isCustom ?? false,
    updatedAt: overrides.updatedAt ?? Date.now(),
  } as Exercise;
}

function makeSet(overrides: Partial<{
  uuid: string;
  workoutExerciseId: string;
  order: number;
  weight: number;
  reps: number;
  isWarmup: boolean;
  isFailure: boolean;
  updatedAt: number;
}> = {}): SetEntry {
  return {
    uuid: overrides.uuid ?? 's-1',
    workoutExerciseId: overrides.workoutExerciseId ?? 'we-1',
    order: overrides.order ?? 1,
    weight: overrides.weight ?? 100,
    reps: overrides.reps ?? 8,
    isWarmup: overrides.isWarmup ?? false,
    isFailure: overrides.isFailure ?? false,
    updatedAt: overrides.updatedAt ?? Date.now(),
  } as SetEntry;
}

describe('filterWorkoutsByPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = new Date('2026-06-12T12:00:00Z').getTime();

  it('returns all workouts for "all" period', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 100 }),
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 200 }),
    ];
    expect(filterWorkoutsByPeriod(workouts, 'all')).toEqual(workouts);
  });

  it('returns all workouts for an unknown period', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 100 }),
    ];
    expect(filterWorkoutsByPeriod(workouts, 'unknown')).toEqual(workouts);
  });

  it('filters workouts within the last week', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 3 }),  // 3 days ago
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 10 }), // 10 days ago
      makeWorkout({ uuid: 'w3', startedAt: now - 86400000 * 7 }),  // exactly 7 days ago
    ];
    const result = filterWorkoutsByPeriod(workouts, 'week');
    expect(result).toHaveLength(2);
    expect(result.map((w: Workout) => w.uuid)).toContain('w1');
    expect(result.map((w: Workout) => w.uuid)).toContain('w3');
  });

  it('filters workouts within the last month', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 10 }),  // 10 days ago
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 40 }),  // 40 days ago
      makeWorkout({ uuid: 'w3', startedAt: now - 86400000 * 30 }),  // 30 days ago
    ];
    const result = filterWorkoutsByPeriod(workouts, 'month');
    expect(result).toHaveLength(2);
    expect(result.map((w: Workout) => w.uuid)).toContain('w1');
    expect(result.map((w: Workout) => w.uuid)).toContain('w3');
  });

  it('filters workouts within the last 3 months', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 30 }),   // 30 days ago
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 100 }),  // 100 days ago
      makeWorkout({ uuid: 'w3', startedAt: now - 86400000 * 90 }),   // 90 days ago
    ];
    const result = filterWorkoutsByPeriod(workouts, '3months');
    expect(result).toHaveLength(2);
    expect(result.map((w: Workout) => w.uuid)).toContain('w1');
    expect(result.map((w: Workout) => w.uuid)).toContain('w3');
  });

  it('filters workouts within the last 6 months', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 60 }),   // 60 days ago
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 200 }),  // 200 days ago
      makeWorkout({ uuid: 'w3', startedAt: now - 86400000 * 180 }),  // 180 days ago
    ];
    const result = filterWorkoutsByPeriod(workouts, '6months');
    expect(result).toHaveLength(2);
    expect(result.map((w: Workout) => w.uuid)).toContain('w1');
    expect(result.map((w: Workout) => w.uuid)).toContain('w3');
  });

  it('filters workouts within the last year', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: now - 86400000 * 100 }),   // 100 days ago
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 400 }),  // 400 days ago
      makeWorkout({ uuid: 'w3', startedAt: now - 86400000 * 365 }),  // 365 days ago
    ];
    const result = filterWorkoutsByPeriod(workouts, 'year');
    expect(result).toHaveLength(2);
    expect(result.map((w: Workout) => w.uuid)).toContain('w1');
    expect(result.map((w: Workout) => w.uuid)).toContain('w3');
  });

  it('excludes workouts with startedAt of 0', () => {
    const workouts = [
      makeWorkout({ uuid: 'w1', startedAt: 0 }),
      makeWorkout({ uuid: 'w2', startedAt: now - 86400000 * 3 }),
    ];
    const result = filterWorkoutsByPeriod(workouts, 'week');
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('w2');
  });
});

describe('calculateAvgWorkoutsPerWeek', () => {
  it('returns 0 for empty workouts array', () => {
    expect(calculateAvgWorkoutsPerWeek([], 'week')).toBe(0);
  });

  it('calculates average for "week" period (1 week)', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
    ];
    expect(calculateAvgWorkoutsPerWeek(workouts, 'week')).toBe(3);
  });

  it('calculates average for "month" period (4 weeks)', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
    ];
    expect(calculateAvgWorkoutsPerWeek(workouts, 'month')).toBe(1);
  });

  it('calculates average for "3months" period (12 weeks)', () => {
    const workouts = Array.from({ length: 12 }, () =>
      makeWorkout({ startedAt: Date.now() })
    );
    expect(calculateAvgWorkoutsPerWeek(workouts, '3months')).toBe(1);
  });

  it('calculates average for "6months" period (24 weeks)', () => {
    const workouts = Array.from({ length: 24 }, () =>
      makeWorkout({ startedAt: Date.now() })
    );
    expect(calculateAvgWorkoutsPerWeek(workouts, '6months')).toBe(1);
  });

  it('calculates average for "year" period (52 weeks)', () => {
    const workouts = Array.from({ length: 52 }, () =>
      makeWorkout({ startedAt: Date.now() })
    );
    expect(calculateAvgWorkoutsPerWeek(workouts, 'year')).toBe(1);
  });

  it('calculates average for "all" period using actual date range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));
    const twoWeeksAgo = new Date('2026-05-29T12:00:00Z').getTime();
    const now = new Date('2026-06-12T12:00:00Z').getTime();
    const workouts = [
      makeWorkout({ startedAt: twoWeeksAgo }),
      makeWorkout({ startedAt: now }),
    ];
    const result = calculateAvgWorkoutsPerWeek(workouts, 'all');
    // 2 workouts over ~2 weeks = 1 per week
    expect(result).toBeGreaterThanOrEqual(0.9);
    expect(result).toBeLessThanOrEqual(1.1);
    vi.useRealTimers();
  });

  it('returns fractional average for "month" period', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now() }),
      makeWorkout({ startedAt: Date.now() }),
    ];
    expect(calculateAvgWorkoutsPerWeek(workouts, 'month')).toBe(0.5);
  });
});

describe('calculateMuscleDistribution', () => {
  it('returns empty array for empty sets', () => {
    expect(calculateMuscleDistribution([], [], [])).toEqual([]);
  });

  it('calculates volume for a single muscle group', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('chest');
    expect(result[0].volume).toBe(1600); // 2 * (100 * 8)
    expect(result[0].topExercises[0].name).toBe('Bench Press');
    expect(result[0].topExercises[0].volume).toBe(1600);
  });

  it('calculates volume for multiple muscle groups sorted by volume', () => {
    const exercises = [
      makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' }),
      makeExercise({ uuid: 'ex-2', name: 'Squat', muscleGroup: 'legs' }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', exerciseId: 'ex-2' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }), // 800
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }), // 1000
    ];

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('legs');
    expect(result[0].volume).toBe(1000);
    expect(result[1].name).toBe('chest');
    expect(result[1].volume).toBe(800);
  });

  it('skips sets with missing workoutExercise', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-999' }), // missing we
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(800);
  });

  it('skips sets with missing exercise', () => {
    const exercises: Exercise[] = [];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-999' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result).toEqual([]);
  });

  it('limits top exercises to 5', () => {
    const exercises = Array.from({ length: 7 }, (_, i) =>
      makeExercise({ uuid: `ex-${i}`, name: `Exercise ${i}`, muscleGroup: 'chest' })
    );
    const workoutExercises = Array.from({ length: 7 }, (_, i) =>
      makeWorkoutExercise({ uuid: `we-${i}`, exerciseId: `ex-${i}` })
    );
    const sets = exercises.flatMap((_, i) =>
      makeSet({ weight: 100, reps: 1, workoutExerciseId: `we-${i}` })
    );

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].topExercises).toHaveLength(5);
  });

  it('sorts top exercises by volume descending', () => {
    const exercises = [
      makeExercise({ uuid: 'ex-1', name: 'Light', muscleGroup: 'chest' }),
      makeExercise({ uuid: 'ex-2', name: 'Heavy', muscleGroup: 'chest' }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', exerciseId: 'ex-2' }),
    ];
    const sets = [
      makeSet({ weight: 50, reps: 10, workoutExerciseId: 'we-1' }), // 500
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }), // 1000
    ];

    const result = calculateMuscleDistribution(sets, workoutExercises, exercises);
    expect(result[0].topExercises[0].name).toBe('Heavy');
    expect(result[0].topExercises[1].name).toBe('Light');
  });
});

describe('calculateWorkoutsOverTime', () => {
  it('returns empty array for no workouts', () => {
    expect(calculateWorkoutsOverTime([])).toEqual([]);
  });

  it('groups workouts in the same week', () => {
    // Both on Monday June 8 2026
    const w1 = makeWorkout({ startedAt: new Date('2026-06-08T10:00:00Z').getTime() });
    const w2 = makeWorkout({ startedAt: new Date('2026-06-10T10:00:00Z').getTime() });
    // Wednesday June 10 is in the same week as Monday June 8

    const result = calculateWorkoutsOverTime([w1, w2]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('separates workouts into different weeks', () => {
    const w1 = makeWorkout({ startedAt: new Date('2026-06-01T10:00:00Z').getTime() }); // Mon week of June 1
    const w2 = makeWorkout({ startedAt: new Date('2026-06-15T10:00:00Z').getTime() }); // Mon week of June 15

    const result = calculateWorkoutsOverTime([w1, w2]);
    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });

  it('sorts results by week ascending', () => {
    const w1 = makeWorkout({ startedAt: new Date('2026-06-15T10:00:00Z').getTime() });
    const w2 = makeWorkout({ startedAt: new Date('2026-06-01T10:00:00Z').getTime() });

    const result = calculateWorkoutsOverTime([w1, w2]);
    // week of June 1 should come before week of June 15
    const date0 = new Date(result[0].week.split('-').map(Number)).getTime();
    const date1 = new Date(result[1].week.split('-').map(Number)).getTime();
    expect(date0).toBeLessThan(date1);
  });

  it('skips workouts without startedAt', () => {
    const w1 = makeWorkout({ startedAt: 0 });
    const w2 = makeWorkout({ startedAt: new Date('2026-06-08T10:00:00Z').getTime() });

    const result = calculateWorkoutsOverTime([w1, w2]);
    expect(result).toHaveLength(1);
  });
});

describe('calculateTonnageOverTime', () => {
  it('returns empty array for empty sets', () => {
    expect(calculateTonnageOverTime([], [], [])).toEqual([]);
  });

  it('calculates tonnage for a single set', () => {
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1' })];
    const sets = [makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' })];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    expect(result).toHaveLength(1);
    expect(result[0].tonnage).toBe(800);
  });

  it('aggregates tonnage across multiple sets in the same week', () => {
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-1' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }), // 800
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }), // 1000
    ];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    expect(result).toHaveLength(1);
    expect(result[0].tonnage).toBe(1800);
  });

  it('separates tonnage across different weeks', () => {
    const workouts = [
      makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-01T10:00:00Z').getTime() }),
      makeWorkout({ uuid: 'w-2', startedAt: new Date('2026-06-15T10:00:00Z').getTime() }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-2' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }), // 800
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }), // 1000
    ];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    expect(result).toHaveLength(2);
    expect(result[0].tonnage).toBe(800);
    expect(result[1].tonnage).toBe(1000);
  });

  it('skips sets with missing workoutExercise', () => {
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-999' }), // missing
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    expect(result).toHaveLength(1);
    expect(result[0].tonnage).toBe(800);
  });

  it('skips sets with missing workout', () => {
    const workouts: Workout[] = [];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-999' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    expect(result).toEqual([]);
  });

  it('sorts results by week ascending', () => {
    const workouts = [
      makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-15T10:00:00Z').getTime() }),
      makeWorkout({ uuid: 'w-2', startedAt: new Date('2026-06-01T10:00:00Z').getTime() }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-2' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }),
    ];

    const result = calculateTonnageOverTime(sets, workoutExercises, workouts);
    const date0 = new Date(result[0].week.split('-').map(Number)).getTime();
    const date1 = new Date(result[1].week.split('-').map(Number)).getTime();
    expect(date0).toBeLessThan(date1);
  });
});

describe('calculateBodyWeightOverTime', () => {
  it('returns empty array for no workouts', () => {
    expect(calculateBodyWeightOverTime([])).toEqual([]);
  });

  it('returns empty array when no workouts have bodyWeight', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now(), bodyWeight: undefined }),
    ];
    expect(calculateBodyWeightOverTime(workouts)).toEqual([]);
  });

  it('includes workouts with valid bodyWeight', () => {
    const now = Date.now();
    const workouts = [
      makeWorkout({ startedAt: now, bodyWeight: 80 }),
    ];
    const result = calculateBodyWeightOverTime(workouts);
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBe(80);
  });

  it('filters out workouts with bodyWeight of 0', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now(), bodyWeight: 0 }),
    ];
    expect(calculateBodyWeightOverTime(workouts)).toEqual([]);
  });

  it('filters out workouts with bodyWeight >= 500', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now(), bodyWeight: 500 }),
      makeWorkout({ startedAt: Date.now(), bodyWeight: 600 }),
    ];
    expect(calculateBodyWeightOverTime(workouts)).toEqual([]);
  });

  it('includes workouts with bodyWeight just under 500', () => {
    const workouts = [
      makeWorkout({ startedAt: Date.now(), bodyWeight: 499.9 }),
    ];
    const result = calculateBodyWeightOverTime(workouts);
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBe(499.9);
  });

  it('sorts by startedAt ascending', () => {
    const workouts = [
      makeWorkout({ startedAt: new Date('2026-06-10').getTime(), bodyWeight: 82 }),
      makeWorkout({ startedAt: new Date('2026-06-01').getTime(), bodyWeight: 80 }),
      makeWorkout({ startedAt: new Date('2026-06-15').getTime(), bodyWeight: 81 }),
    ];
    const result = calculateBodyWeightOverTime(workouts);
    expect(result).toHaveLength(3);
    expect(result[0].weight).toBe(80);
    expect(result[1].weight).toBe(82);
    expect(result[2].weight).toBe(81);
  });

  it('formats week label as short date string', () => {
    const workouts = [
      makeWorkout({ startedAt: new Date('2026-06-12T12:00:00Z').getTime(), bodyWeight: 80 }),
    ];
    const result = calculateBodyWeightOverTime(workouts);
    expect(result[0].week).toBeTypeOf('string');
    expect(result[0].week.length).toBeGreaterThan(0);
  });
});

describe('calculateMuscleDistributionOverTime', () => {
  it('returns empty array for empty sets', () => {
    expect(calculateMuscleDistributionOverTime([], [], [], [])).toEqual([]);
  });

  it('groups sets by week and muscle group', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].muscles['chest']).toBe(1600);
  });

  it('separates data across multiple weeks', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workouts = [
      makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-01T10:00:00Z').getTime() }),
      makeWorkout({ uuid: 'w-2', startedAt: new Date('2026-06-15T10:00:00Z').getTime() }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-2', exerciseId: 'ex-1' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toHaveLength(2);
    expect(result[0].muscles['chest']).toBe(800);
    expect(result[1].muscles['chest']).toBe(1000);
  });

  it('handles multiple muscle groups in same week', () => {
    const exercises = [
      makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' }),
      makeExercise({ uuid: 'ex-2', name: 'Squat', muscleGroup: 'legs' }),
    ];
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-1', exerciseId: 'ex-2' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 200, reps: 5, workoutExerciseId: 'we-2' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].muscles['chest']).toBe(800);
    expect(result[0].muscles['legs']).toBe(1000);
  });

  it('skips sets with missing workoutExercise', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-999' }), // missing
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toHaveLength(1);
    expect(result[0].muscles['chest']).toBe(800);
  });

  it('skips sets with missing exercise', () => {
    const exercises: Exercise[] = [];
    const workouts = [makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-08T10:00:00Z').getTime() })];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-999' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toEqual([]);
  });

  it('skips sets with missing workout', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workouts: Workout[] = [];
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-999', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    expect(result).toEqual([]);
  });

  it('sorts weeks ascending', () => {
    const exercises = [makeExercise({ uuid: 'ex-1', name: 'Bench Press', muscleGroup: 'chest' })];
    const workouts = [
      makeWorkout({ uuid: 'w-1', startedAt: new Date('2026-06-15T10:00:00Z').getTime() }),
      makeWorkout({ uuid: 'w-2', startedAt: new Date('2026-06-01T10:00:00Z').getTime() }),
    ];
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', workoutId: 'w-2', exerciseId: 'ex-1' }),
    ];
    const sets = [
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-1' }),
      makeSet({ weight: 100, reps: 8, workoutExerciseId: 'we-2' }),
    ];

    const result = calculateMuscleDistributionOverTime(sets, workoutExercises, workouts, exercises);
    const date0 = new Date(result[0].week.split('-').map(Number)).getTime();
    const date1 = new Date(result[1].week.split('-').map(Number)).getTime();
    expect(date0).toBeLessThan(date1);
  });
});

describe('calculatePRs', () => {
  it('returns 0 for empty sets', () => {
    expect(calculatePRs([], [])).toBe(0);
  });

  it('counts a single exercise with sets', () => {
    const workoutExercises = [makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' })];
    const sets = [
      makeSet({ workoutExerciseId: 'we-1' }),
      makeSet({ workoutExerciseId: 'we-1' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(1);
  });

  it('counts multiple distinct exercises', () => {
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', exerciseId: 'ex-2' }),
      makeWorkoutExercise({ uuid: 'we-3', exerciseId: 'ex-3' }),
    ];
    const sets = [
      makeSet({ workoutExerciseId: 'we-1' }),
      makeSet({ workoutExerciseId: 'we-2' }),
      makeSet({ workoutExerciseId: 'we-3' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(3);
  });

  it('does not double-count the same exercise across multiple sets', () => {
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', exerciseId: 'ex-1' }),
    ];
    const sets = [
      makeSet({ workoutExerciseId: 'we-1' }),
      makeSet({ workoutExerciseId: 'we-2' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(1);
  });

  it('ignores sets with no matching workoutExercise', () => {
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
    ];
    const sets = [
      makeSet({ workoutExerciseId: 'we-999' }), // no matching we
      makeSet({ workoutExerciseId: 'we-1' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(1);
  });

  it('returns 0 when all sets have missing workoutExercises', () => {
    const workoutExercises: WorkoutExercise[] = [];
    const sets = [
      makeSet({ workoutExerciseId: 'we-999' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(0);
  });

  it('counts exercises from different workoutExercises pointing to different exercises', () => {
    const workoutExercises = [
      makeWorkoutExercise({ uuid: 'we-1', exerciseId: 'ex-1' }),
      makeWorkoutExercise({ uuid: 'we-2', exerciseId: 'ex-2' }),
    ];
    const sets = [
      makeSet({ workoutExerciseId: 'we-1' }),
      makeSet({ workoutExerciseId: 'we-2' }),
      makeSet({ workoutExerciseId: 'we-1' }),
    ];

    expect(calculatePRs(sets, workoutExercises)).toBe(2);
  });
});
