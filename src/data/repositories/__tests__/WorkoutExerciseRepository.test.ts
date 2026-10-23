import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/db';
import { WorkoutExerciseRepository } from '../WorkoutExerciseRepository';
import { SetRepository } from '../SetRepository';
import { resetTestDatabase } from '../../../test-utils/db';

async function seedWorkout() {
  await db.workouts.add({
    uuid: 'w-1',
    startedAt: 1_000,
    workoutDay: '2026-01-01',
    status: 'active',
    setsCount: 0,
    totalTonnage: 0,
    exerciseCount: 0,
    updatedAt: 1,
  });
}

describe('WorkoutExerciseRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await seedWorkout();
  });

  it('appends exercises with increasing order and keeps exerciseCount in sync', async () => {
    await WorkoutExerciseRepository.add('w-1', 'ex-a');
    await WorkoutExerciseRepository.add('w-1', 'ex-b');

    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(rows.map(row => row.exerciseId)).toEqual(['ex-a', 'ex-b']);
    expect(rows.map(row => row.order)).toEqual([0, 1]);

    const workout = await db.workouts.where('uuid').equals('w-1').first();
    expect(workout?.exerciseCount).toBe(2);
  });

  it('appends a template in one transaction, preserving its order', async () => {
    await WorkoutExerciseRepository.addMany('w-1', ['ex-x', 'ex-y', 'ex-z']);

    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(rows.map(row => row.exerciseId)).toEqual(['ex-x', 'ex-y', 'ex-z']);
    expect(rows.map(row => row.order)).toEqual([0, 1, 2]);

    // Appending again continues after the existing rows.
    await WorkoutExerciseRepository.addMany('w-1', ['ex-w']);
    const after = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(after.map(row => row.exerciseId)).toEqual(['ex-x', 'ex-y', 'ex-z', 'ex-w']);
  });

  /**
   * Regression: `add` used to insert the join row even when the parent workout did not
   * exist, creating orphan rows that sync but are invisible to every query.
   */
  it('throws for an unknown workout instead of writing an orphan join row', async () => {
    await expect(WorkoutExerciseRepository.add('w-missing', 'ex-a')).rejects.toThrow(/Unknown workout/);
    expect(await db.workoutExercises.count()).toBe(0);
  });

  it('throws for an unknown workout in addMany before inserting any row', async () => {
    await expect(WorkoutExerciseRepository.addMany('w-missing', ['ex-a', 'ex-b'])).rejects.toThrow(
      /Unknown workout/,
    );
    expect(await db.workoutExercises.count()).toBe(0);
  });

  /** Regression: the swap used two independent updates, so a reader could see duplicate orders. */
  it('swaps neighbours atomically', async () => {
    await WorkoutExerciseRepository.add('w-1', 'ex-a');
    await WorkoutExerciseRepository.add('w-1', 'ex-b');
    await WorkoutExerciseRepository.add('w-1', 'ex-c');

    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');
    await WorkoutExerciseRepository.move(rows[2].uuid, 'up');

    const after = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(after.map(row => row.exerciseId)).toEqual(['ex-a', 'ex-c', 'ex-b']);
    expect(after.map(row => row.order)).toEqual([0, 1, 2]);
  });

  it('ignores moves past the ends', async () => {
    await WorkoutExerciseRepository.add('w-1', 'ex-a');
    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');

    await WorkoutExerciseRepository.move(rows[0].uuid, 'up');

    const after = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(after.map(row => row.order)).toEqual([0]);
  });

  it('removes an exercise with its sets, reorders and recounts', async () => {
    await WorkoutExerciseRepository.add('w-1', 'ex-a');
    await WorkoutExerciseRepository.add('w-1', 'ex-b');
    await WorkoutExerciseRepository.add('w-1', 'ex-c');

    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');
    const middle = rows[1];
    await SetRepository.add(middle.uuid, { weight: 100, reps: 5 });

    let workout = await db.workouts.where('uuid').equals('w-1').first();
    expect(workout?.setsCount).toBe(1);
    expect(workout?.exerciseCount).toBe(3);

    await WorkoutExerciseRepository.remove(middle.uuid);

    const remaining = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(remaining.map(row => row.exerciseId)).toEqual(['ex-a', 'ex-c']);
    expect(remaining.map(row => row.order)).toEqual([0, 1]);

    workout = await db.workouts.where('uuid').equals('w-1').first();
    expect(workout?.exerciseCount).toBe(2);
    expect(workout?.setsCount).toBe(0);
    expect(workout?.totalTonnage).toBe(0);

    const sets = await db.sets.where('workoutExerciseId').equals(middle.uuid).toArray();
    expect(sets[0].deletedAt).toBeTypeOf('number');
  });

  /** The aggregate cache must reflect exactly the surviving rows after a removal. */
  it('remove() leaves the workout aggregates consistent for the surviving exercises', async () => {
    await WorkoutExerciseRepository.add('w-1', 'ex-a');
    await WorkoutExerciseRepository.add('w-1', 'ex-b');
    await WorkoutExerciseRepository.add('w-1', 'ex-c');

    const rows = await WorkoutExerciseRepository.listByWorkout('w-1');
    await SetRepository.add(rows[0].uuid, { weight: 60, reps: 5 }); // 300
    await SetRepository.add(rows[1].uuid, { weight: 100, reps: 5 }); // 500
    await SetRepository.add(rows[1].uuid, { weight: 100, reps: 3 }); // 300

    // Removing a middle exercise with sets must recompute counts AND tonnage from scratch.
    await WorkoutExerciseRepository.remove(rows[1].uuid);

    const workout = await db.workouts.where('uuid').equals('w-1').first();
    expect(workout?.exerciseCount).toBe(2);
    expect(workout?.setsCount).toBe(1);
    expect(workout?.totalTonnage).toBe(300);

    // A stale delta (rather than a recount) would have left the tonnage at 1100.
    const remaining = await WorkoutExerciseRepository.listByWorkout('w-1');
    expect(remaining.map(row => row.exerciseId)).toEqual(['ex-a', 'ex-c']);
    expect(remaining.map(row => row.order)).toEqual([0, 1]);
  });
});
