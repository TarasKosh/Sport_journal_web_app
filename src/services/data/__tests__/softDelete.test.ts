import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/db';
import {
  softDeleteExercise,
  softDeleteSet,
  softDeleteWorkout,
  softDeleteWorkoutExerciseAndReorder,
  softDeleteWorkoutTemplate,
} from '../softDelete';
import { onlyActive } from '../../../utils/entityFilters';

async function resetDb() {
  await db.delete();
  await db.open();
  // Clear seed noise for deterministic tests
  await Promise.all([
    db.workouts.clear(),
    db.workoutExercises.clear(),
    db.sets.clear(),
    db.exercises.clear(),
    db.workoutTemplates.clear(),
    db.conflictLog.clear(),
  ]);
}

describe('softDelete', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('cascades soft-delete from workout to exercises and sets', async () => {
    const workoutId = await db.workouts.add({
      uuid: 'w1',
      startedAt: 1,
      workoutDay: '2026-01-01',
      endedAt: 2,
      updatedAt: 1,
    });
    const weId = await db.workoutExercises.add({
      uuid: 'we1',
      workoutId: 'w1',
      exerciseId: 'ex1',
      order: 0,
      updatedAt: 1,
    });
    await db.sets.add({
      uuid: 's1',
      workoutExerciseId: 'we1',
      order: 0,
      weight: 100,
      reps: 5,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    });

    await softDeleteWorkout(workoutId);

    const workout = await db.workouts.get(workoutId);
    const we = await db.workoutExercises.get(weId);
    const set = await db.sets.where('uuid').equals('s1').first();

    expect(workout?.deletedAt).toBeTypeOf('number');
    expect(we?.deletedAt).toBeTypeOf('number');
    expect(set?.deletedAt).toBeTypeOf('number');
  });

  it('soft-deletes a set only', async () => {
    const setId = await db.sets.add({
      uuid: 's2',
      workoutExerciseId: 'we1',
      order: 0,
      weight: 40,
      reps: 8,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    });

    await softDeleteSet(setId);
    const set = await db.sets.get(setId);
    expect(set?.deletedAt).toBeTypeOf('number');
  });

  it('reorders remaining workout exercises after soft-delete', async () => {
    await db.workouts.add({
      uuid: 'w2',
      startedAt: 1,
      workoutDay: '2026-01-02',
      updatedAt: 1,
    });
    const weA = await db.workoutExercises.add({
      uuid: 'weA',
      workoutId: 'w2',
      exerciseId: 'exA',
      order: 0,
      updatedAt: 1,
    });
    const weB = await db.workoutExercises.add({
      uuid: 'weB',
      workoutId: 'w2',
      exerciseId: 'exB',
      order: 1,
      updatedAt: 1,
    });
    const weC = await db.workoutExercises.add({
      uuid: 'weC',
      workoutId: 'w2',
      exerciseId: 'exC',
      order: 2,
      updatedAt: 1,
    });

    await softDeleteWorkoutExerciseAndReorder(weB, 'w2');

    const remaining = onlyActive(await db.workoutExercises.where('workoutId').equals('w2').toArray())
      .sort((a, b) => a.order - b.order);

    expect(remaining.map((r) => r.uuid)).toEqual(['weA', 'weC']);
    expect(remaining.map((r) => r.order)).toEqual([0, 1]);
    expect((await db.workoutExercises.get(weA))?.deletedAt).toBeUndefined();
    expect((await db.workoutExercises.get(weC))?.deletedAt).toBeUndefined();
  });

  it('blocks soft-delete of built-in exercises', async () => {
    const id = await db.exercises.add({
      uuid: 'seed-ex',
      name: 'Squat',
      muscleGroup: 'legs',
      isCustom: false,
      updatedAt: 1,
    });

    await expect(softDeleteExercise(id)).rejects.toThrow(/Built-in/);
    expect((await db.exercises.get(id))?.deletedAt).toBeUndefined();
  });

  it('allows soft-delete of custom exercises', async () => {
    const id = await db.exercises.add({
      uuid: 'custom-ex',
      name: 'My Lift',
      muscleGroup: 'other',
      isCustom: true,
      updatedAt: 1,
    });

    await softDeleteExercise(id);
    expect((await db.exercises.get(id))?.deletedAt).toBeTypeOf('number');
  });

  it('blocks soft-delete of built-in templates', async () => {
    const id = await db.workoutTemplates.add({
      uuid: 'seed-tpl',
      name: 'Push Day',
      exercises: ['ex1'],
      isCustom: false,
      updatedAt: 1,
    });

    await expect(softDeleteWorkoutTemplate(id)).rejects.toThrow(/Built-in/);
    expect((await db.workoutTemplates.get(id))?.deletedAt).toBeUndefined();
  });

  it('allows soft-delete of custom templates', async () => {
    const id = await db.workoutTemplates.add({
      uuid: 'custom-tpl',
      name: 'My Split',
      exercises: ['ex1'],
      isCustom: true,
      updatedAt: 1,
    });

    await softDeleteWorkoutTemplate(id);
    expect((await db.workoutTemplates.get(id))?.deletedAt).toBeTypeOf('number');
  });
});
