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
});
