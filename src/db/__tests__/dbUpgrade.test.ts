import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { recountWorkout } from '../../data/aggregates';

/**
 * Store definitions of the released v4 schema (copied verbatim from db.ts), so a legacy
 * database can be created at version 4 and then opened by AppDatabase to exercise the
 * real v5 upgrade transaction.
 */
const V4_STORES = {
  settings: '++id',
  exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
  workouts: '++id, &uuid, startedAt, endedAt, workoutDay, updatedAt, deletedAt',
  workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
  sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
  conflictLog: '++id, &uuid, entityType, entityId',
  workoutTemplates: '++id, &uuid, name, updatedAt, deletedAt',
};

/**
 * Legacy v4 database holding one workout with:
 * - an active workout-exercise carrying one live set,
 * - a soft-deleted workout-exercise whose child set is still live.
 */
async function createLegacyV4Database(): Promise<void> {
  const legacy = new Dexie('StrengthJournalDB');
  legacy.version(4).stores(V4_STORES);
  await legacy.open();

  await legacy.table('workouts').add({
    uuid: 'w-legacy',
    startedAt: 1000,
    endedAt: 2000,
    workoutDay: '1970-01-01',
    updatedAt: 1,
  });
  await legacy.table('workoutExercises').bulkAdd([
    { uuid: 'we-active', workoutId: 'w-legacy', exerciseId: 'ex-1', order: 0, updatedAt: 1 },
    { uuid: 'we-deleted', workoutId: 'w-legacy', exerciseId: 'ex-2', order: 1, updatedAt: 5, deletedAt: 5 },
  ]);
  await legacy.table('sets').bulkAdd([
    {
      uuid: 'set-active',
      workoutExerciseId: 'we-active',
      order: 0,
      weight: 100,
      reps: 5,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    },
    {
      uuid: 'set-live-under-deleted-parent',
      workoutExerciseId: 'we-deleted',
      order: 0,
      weight: 100,
      reps: 5,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    },
  ]);

  await legacy.close();
}

describe('v5 upgrade backfill', () => {
  /**
   * Regression: the backfill counted every live set regardless of its parent, while
   * `recountWorkout` only counts sets whose workout-exercise parent exists and is not
   * soft-deleted. A workout with a deleted join row but live child sets got a cache that
   * disagreed with any later recount.
   */
  it('matches recountWorkout when a live set hangs under a soft-deleted workout-exercise', async () => {
    await db.delete();
    await createLegacyV4Database();
    await db.open(); // runs the v5 upgrade over the legacy rows

    const backfilled = await db.workouts.where('uuid').equals('w-legacy').first();
    expect(backfilled).toBeTruthy();
    expect(backfilled!.status).toBe('finished');
    expect(backfilled!.setsCount).toBe(1);
    expect(backfilled!.totalTonnage).toBe(500);
    expect(backfilled!.exerciseCount).toBe(1);

    await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
      await recountWorkout('w-legacy');
    });
    const recounted = await db.workouts.where('uuid').equals('w-legacy').first();

    expect(backfilled!.setsCount).toBe(recounted!.setsCount);
    expect(backfilled!.totalTonnage).toBe(recounted!.totalTonnage);
    expect(backfilled!.exerciseCount).toBe(recounted!.exerciseCount);
  });
});
