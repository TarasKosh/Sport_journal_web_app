import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/db';
import { SetRepository } from '../SetRepository';
import { resetTestDatabase } from '../../../test-utils/db';

async function seedWorkout(options: { startedAt: number; day: string }) {
  await db.workouts.add({
    uuid: `w-${options.day}`,
    startedAt: options.startedAt,
    workoutDay: options.day,
    status: 'finished',
    setsCount: 0,
    totalTonnage: 0,
    exerciseCount: 0,
    updatedAt: options.startedAt,
  });
  await db.workoutExercises.add({
    uuid: `we-${options.day}`,
    workoutId: `w-${options.day}`,
    exerciseId: 'ex-bench',
    order: 0,
    updatedAt: options.startedAt,
  });
  return { workoutUuid: `w-${options.day}`, workoutExerciseUuid: `we-${options.day}` };
}

describe('SetRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('adds a set with the next order and denormalized parent keys', async () => {
    const { workoutExerciseUuid } = await seedWorkout({ startedAt: 1_000, day: '2026-01-01' });

    const first = await SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 });
    const second = await SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 });

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
    expect(first.exerciseId).toBe('ex-bench');
    expect(first.workoutId).toBe('w-2026-01-01');
    expect(first.performedAt).toBe(1_000);
    expect(second.exerciseId).toBe('ex-bench');
  });

  /**
   * Regression: `order` used to be computed from a possibly stale live-query array outside a
   * transaction, so two rapid "Add set" taps produced two rows with the same order.
   */
  it('assigns unique orders for concurrent adds', async () => {
    const { workoutExerciseUuid } = await seedWorkout({ startedAt: 1_000, day: '2026-01-01' });

    await Promise.all([
      SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 }),
      SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 }),
      SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 }),
    ]);

    const sets = await SetRepository.listByWorkoutExercise(workoutExerciseUuid);
    expect(sets.map(set => set.order)).toEqual([0, 1, 2]);
  });

  it('keeps the workout tonnage cache in sync on add, update and delete', async () => {
    const { workoutUuid, workoutExerciseUuid } = await seedWorkout({ startedAt: 1_000, day: '2026-01-01' });

    const set = await SetRepository.add(workoutExerciseUuid, { weight: 100, reps: 5 });
    let workout = await db.workouts.where('uuid').equals(workoutUuid).first();
    expect(workout?.setsCount).toBe(1);
    expect(workout?.totalTonnage).toBe(500);

    await SetRepository.update(set.id!, { weight: 120 });
    workout = await db.workouts.where('uuid').equals(workoutUuid).first();
    expect(workout?.totalTonnage).toBe(600);

    // Warm-up/zero-rep work contributes nothing to tonnage.
    await SetRepository.update(set.id!, { reps: 0 });
    workout = await db.workouts.where('uuid').equals(workoutUuid).first();
    expect(workout?.totalTonnage).toBe(0);

    await SetRepository.softDelete(set.id!);
    workout = await db.workouts.where('uuid').equals(workoutUuid).first();
    expect(workout?.setsCount).toBe(0);

    const active = await SetRepository.listByWorkoutExercise(workoutExerciseUuid);
    expect(active).toHaveLength(0);
  });

  /**
   * Regression: prefill used `updatedAt` as "recency", so editing an old workout made it the
   * source of the next set's weight.
   */
  it('resolves the last performance by workout date, not by edit time', async () => {
    const older = await seedWorkout({ startedAt: 1_000, day: '2026-01-01' });
    const newer = await seedWorkout({ startedAt: 2_000, day: '2026-01-02' });

    await SetRepository.add(older.workoutExerciseUuid, { weight: 50, reps: 5 });
    const newestSet = await SetRepository.add(newer.workoutExerciseUuid, { weight: 80, reps: 5 });

    // Editing the old workout must not promote it to "latest".
    await SetRepository.update(newestSet.id!, { reps: 5 });
    const oldSets = await db.sets.where('workoutExerciseId').equals(older.workoutExerciseUuid).toArray();
    await SetRepository.update(oldSets[0].id!, { weight: 55 });

    const last = await SetRepository.lastPerformance('ex-bench');
    expect(last?.weight).toBe(80);
  });

  it('exposes recent sets per exercise from the denormalized index', async () => {
    const older = await seedWorkout({ startedAt: 1_000, day: '2026-01-01' });
    const newer = await seedWorkout({ startedAt: 2_000, day: '2026-01-02' });

    await SetRepository.add(older.workoutExerciseUuid, { weight: 50, reps: 5 });
    await SetRepository.add(newer.workoutExerciseUuid, { weight: 80, reps: 5 });

    const recent = await SetRepository.recentByExercise('ex-bench', 10);
    expect(recent.map(set => set.weight)).toEqual([50, 80]);
  });

  it('falls back to the join path for rows without denormalized keys', async () => {
    const { workoutExerciseUuid } = await seedWorkout({ startedAt: 5_000, day: '2026-03-01' });
    // Row written the "old client" way: no exerciseId / performedAt.
    await db.sets.add({
      uuid: 'legacy-set',
      workoutExerciseId: workoutExerciseUuid,
      order: 0,
      weight: 42,
      reps: 5,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    });

    const recent = await SetRepository.recentByExercise('ex-bench', 10);
    expect(recent.map(set => set.uuid)).toEqual(['legacy-set']);
    expect(recent[0].performedAt).toBe(5_000);

    const last = await SetRepository.lastPerformance('ex-bench');
    expect(last?.uuid).toBe('legacy-set');
  });

  it('throws for an unknown workout exercise instead of writing an orphan row', async () => {
    await expect(SetRepository.add('we-missing', { weight: 1, reps: 1 })).rejects.toThrow(/Unknown workout exercise/);
    expect(await db.sets.count()).toBe(0);
  });
});
