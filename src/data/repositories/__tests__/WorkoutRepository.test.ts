import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/db';
import { WorkoutRepository } from '../WorkoutRepository';
import { resetTestDatabase } from '../../../test-utils/db';
import { dayStringFromTimestamp } from '../../../domain/workout';

describe('WorkoutRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('starts an indexed active workout', async () => {
    const startedAt = Date.now();
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-05', bodyWeightKg: 82 });

    expect(workout.status).toBe('active');
    expect(workout.workoutDay).toBe('2026-01-05');
    expect(workout.bodyWeight).toBe(82);
    expect(workout.setsCount).toBe(0);
    expect(workout.totalTonnage).toBe(0);
    expect(workout.startedAt).toBeGreaterThanOrEqual(startedAt);

    const active = await WorkoutRepository.getActive();
    expect(active?.uuid).toBe(workout.uuid);
  });

  it('derives the workout day when none is given', async () => {
    const workout = await WorkoutRepository.start();
    expect(workout.workoutDay).toBe(dayStringFromTimestamp(workout.startedAt));
  });

  it('finishing removes it from the active lookup and adds it to history', async () => {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-05' });
    await WorkoutRepository.finish(workout.uuid);

    expect(await WorkoutRepository.getActive()).toBeUndefined();
    expect(await WorkoutRepository.countFinished()).toBe(1);

    const page = await WorkoutRepository.listFinishedPage(0, 10);
    expect(page.map(row => row.uuid)).toEqual([workout.uuid]);
    expect(page[0].endedAt).toBeTypeOf('number');
  });

  /**
   * Regression: `finish()` used to write `status: 'finished'` unconditionally, so finishing
   * a soft-deleted workout resurrected it into every history/stats query.
   */
  it('does not resurrect a soft-deleted workout on finish', async () => {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-05' });
    await WorkoutRepository.finish(workout.uuid);
    await WorkoutRepository.softDelete(workout.uuid);
    const beforeSecondFinish = await db.workouts.where('uuid').equals(workout.uuid).first();

    const finished = await WorkoutRepository.finish(workout.uuid);

    expect(finished).toBe(false);
    expect(await WorkoutRepository.countFinished()).toBe(0);
    expect(await WorkoutRepository.listFinishedPage(0, 10)).toHaveLength(0);

    const stored = await db.workouts.where('uuid').equals(workout.uuid).first();
    expect(stored?.status).toBe('deleted');
    expect(stored?.deletedAt).toBeTypeOf('number');
    // The row is left byte-for-byte untouched (no updatedAt churn for sync).
    expect(stored?.updatedAt).toBe(beforeSecondFinish?.updatedAt);
    expect(stored?.endedAt).toBe(beforeSecondFinish?.endedAt);
  });

  it('reports success when finishing a live workout', async () => {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-06' });

    const finished = await WorkoutRepository.finish(workout.uuid);

    expect(finished).toBe(true);
    expect(await WorkoutRepository.countFinished()).toBe(1);
  });

  it('pages finished workouts newest day first', async () => {
    for (const day of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']) {
      const workout = await WorkoutRepository.start({ workoutDay: day });
      await WorkoutRepository.finish(workout.uuid);
    }

    const firstPage = await WorkoutRepository.listFinishedPage(0, 2);
    const secondPage = await WorkoutRepository.listFinishedPage(2, 2);

    expect(firstPage.map(row => row.workoutDay)).toEqual(['2026-01-04', '2026-01-03']);
    expect(secondPage.map(row => row.workoutDay)).toEqual(['2026-01-02', '2026-01-01']);
  });

  it('lists finished workouts for one day only', async () => {
    const a = await WorkoutRepository.start({ workoutDay: '2026-02-01' });
    const b = await WorkoutRepository.start({ workoutDay: '2026-02-02' });
    await WorkoutRepository.finish(a.uuid);
    await WorkoutRepository.finish(b.uuid);

    const rows = await WorkoutRepository.listFinishedByDay('2026-02-01');
    expect(rows.map(row => row.uuid)).toEqual([a.uuid]);
  });

  it('patches metadata, re-deriving the day and bumping updatedAt', async () => {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-03-01' });
    await WorkoutRepository.updateMetadata(workout.uuid, { title: 'Push day' });

    const stored = await db.workouts.where('uuid').equals(workout.uuid).first();
    expect(stored?.title).toBe('Push day');
    expect(stored?.updatedAt).toBeGreaterThan(workout.updatedAt);

    // An empty day falls back to the start timestamp rather than persisting an empty string.
    await WorkoutRepository.updateMetadata(workout.uuid, { workoutDay: '' });
    const afterEmptyDay = await db.workouts.where('uuid').equals(workout.uuid).first();
    expect(afterEmptyDay?.workoutDay).toBe(dayStringFromTimestamp(workout.startedAt));
  });

  it('soft-deletes by status so indexed queries stop seeing the row', async () => {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-03-02' });
    await WorkoutRepository.finish(workout.uuid);
    await WorkoutRepository.softDelete(workout.uuid);

    const stored = await db.workouts.where('uuid').equals(workout.uuid).first();
    expect(stored?.deletedAt).toBeTypeOf('number');
    expect(stored?.status).toBe('deleted');
    expect(await WorkoutRepository.countFinished()).toBe(0);
    expect(await WorkoutRepository.listFinishedPage(0, 10)).toHaveLength(0);
  });

  it('returns the most recent logged body weight', async () => {
    const older = await WorkoutRepository.start({ workoutDay: '2026-04-01', bodyWeightKg: 80 });
    await WorkoutRepository.finish(older.uuid);
    const newer = await WorkoutRepository.start({ workoutDay: '2026-04-02', bodyWeightKg: 81 });
    await WorkoutRepository.finish(newer.uuid);

    expect(await WorkoutRepository.lastBodyWeightKg()).toBe(81);
  });
});
