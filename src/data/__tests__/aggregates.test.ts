import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { applyAggregateDelta, recountWorkout } from '../aggregates';
import { resetTestDatabase } from '../../test-utils/db';

/**
 * Regression: `applyAggregateDelta` accumulated raw float deltas while `summarizeSets`
 * rounds to 3 decimals, so the cached `totalTonnage` drifted from a recounted value in
 * the last decimals (0.1 + 0.2 = 0.30000000000000004). Both paths must round identically.
 */
describe('applyAggregateDelta', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('rounds accumulated tonnage like summarizeSets so the cache matches a recount', async () => {
    await db.workouts.add({
      uuid: 'w-agg',
      startedAt: 1000,
      workoutDay: '2026-01-01',
      updatedAt: 1,
      setsCount: 0,
      totalTonnage: 0,
      exerciseCount: 0,
    });
    await db.workoutExercises.add({
      uuid: 'we-agg',
      workoutId: 'w-agg',
      exerciseId: 'ex-agg',
      order: 0,
      updatedAt: 1,
    });
    // Two sets whose tonnage (weight * reps) needs more than 3 decimals.
    await db.sets.bulkAdd([
      {
        uuid: 's-1',
        workoutExerciseId: 'we-agg',
        workoutId: 'w-agg',
        exerciseId: 'ex-agg',
        order: 0,
        weight: 0.1,
        reps: 1,
        isWarmup: false,
        isFailure: false,
        updatedAt: 1,
      },
      {
        uuid: 's-2',
        workoutExerciseId: 'we-agg',
        workoutId: 'w-agg',
        exerciseId: 'ex-agg',
        order: 1,
        weight: 0.2,
        reps: 1,
        isWarmup: false,
        isFailure: false,
        updatedAt: 1,
      },
    ]);

    await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
      await applyAggregateDelta('w-agg', { setsCount: 1, totalTonnage: 0.1 });
      await applyAggregateDelta('w-agg', { setsCount: 1, totalTonnage: 0.2 });
    });

    const cached = await db.workouts.where('uuid').equals('w-agg').first();
    // Pre-fix this is 0.30000000000000004.
    expect(cached!.totalTonnage).toBe(0.3);

    await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
      await recountWorkout('w-agg');
    });
    const recounted = await db.workouts.where('uuid').equals('w-agg').first();

    expect(recounted!.totalTonnage).toBe(0.3);
    expect(cached!.totalTonnage).toBe(recounted!.totalTonnage);
  });
});
