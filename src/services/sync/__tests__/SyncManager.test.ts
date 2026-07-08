import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/db';
import { SyncManager } from '../SyncManager';
import type { SyncProvider, SyncSnapshot } from '../types';
import { SCHEMA_VERSION } from '../validateSnapshot';
import { MassUnit, RPEType } from '../../../types';

const noopProvider: SyncProvider = {
  name: 'test',
  async connect() {},
  async disconnect() {},
  async isAuthenticated() {
    return true;
  },
  async pull() {
    return null;
  },
  async push() {},
};

function emptySnapshot(overrides: Partial<SyncSnapshot> = {}): SyncSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    deviceId: 'remote-device',
    data: {
      settings: [],
      exercises: [],
      workouts: [],
      workoutExercises: [],
      sets: [],
      workoutTemplates: [],
      conflictLog: [],
    },
    ...overrides,
  };
}

async function resetDb() {
  await db.delete();
  await db.open();
  await Promise.all([
    db.settings.clear(),
    db.workouts.clear(),
    db.workoutExercises.clear(),
    db.sets.clear(),
    db.exercises.clear(),
    db.workoutTemplates.clear(),
    db.conflictLog.clear(),
  ]);
}

describe('SyncManager.mergeSnapshot', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('adds new remote exercise and strips remote id', async () => {
    const manager = new SyncManager(noopProvider);
    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              id: 999,
              uuid: 'ex-remote',
              name: 'Remote Press',
              muscleGroup: 'chest',
              isCustom: true,
              updatedAt: 10,
            },
          ],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    const local = await db.exercises.where('uuid').equals('ex-remote').first();
    expect(local).toBeTruthy();
    expect(local?.id).not.toBe(999);
    expect(local?.name).toBe('Remote Press');
  });

  it('remote newer wins and preserves local id', async () => {
    const manager = new SyncManager(noopProvider);
    const localId = await db.exercises.add({
      uuid: 'ex-shared',
      name: 'Local Name',
      muscleGroup: 'back',
      isCustom: true,
      updatedAt: 5,
    });

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              id: 42,
              uuid: 'ex-shared',
              name: 'Remote Name',
              muscleGroup: 'back',
              isCustom: true,
              updatedAt: 20,
            },
          ],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    const merged = await db.exercises.where('uuid').equals('ex-shared').first();
    expect(merged?.id).toBe(localId);
    expect(merged?.name).toBe('Remote Name');
    expect(merged?.updatedAt).toBe(20);
  });

  it('keeps local when updatedAt is equal', async () => {
    const manager = new SyncManager(noopProvider);
    await db.exercises.add({
      uuid: 'ex-eq',
      name: 'Local Keep',
      muscleGroup: 'legs',
      isCustom: true,
      updatedAt: 15,
    });

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              uuid: 'ex-eq',
              name: 'Remote Discard',
              muscleGroup: 'legs',
              isCustom: true,
              updatedAt: 15,
            },
          ],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    const kept = await db.exercises.where('uuid').equals('ex-eq').first();
    expect(kept?.name).toBe('Local Keep');
  });

  it('settings LWW: remote newer overwrites, equal keeps local', async () => {
    const manager = new SyncManager(noopProvider);
    await db.settings.add({
      massUnit: MassUnit.KG,
      weightStep: 2.5,
      defaultRPEType: RPEType.RPE,
      theme: 'dark',
      language: 'en',
      updatedAt: 10,
    });

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [
            {
              massUnit: MassUnit.LB,
              weightStep: 5,
              defaultRPEType: RPEType.RIR,
              theme: 'light',
              language: 'en',
              updatedAt: 50,
            },
          ],
          exercises: [],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    let settings = await db.settings.toCollection().first();
    expect(settings?.massUnit).toBe(MassUnit.LB);
    expect(settings?.theme).toBe('light');

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [
            {
              massUnit: MassUnit.KG,
              weightStep: 1,
              defaultRPEType: RPEType.RPE,
              theme: 'system',
              language: 'en',
              updatedAt: 50, // equal → keep local (remote-from-previous)
            },
          ],
          exercises: [],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    settings = await db.settings.toCollection().first();
    expect(settings?.massUnit).toBe(MassUnit.LB);
    expect(settings?.theme).toBe('light');
  });

  it('logs conflict only when fields diverge', async () => {
    const manager = new SyncManager(noopProvider);
    await db.exercises.add({
      uuid: 'ex-div',
      name: 'Same',
      muscleGroup: 'arms',
      isCustom: true,
      updatedAt: 1,
      notes: 'a',
    });

    // Same payload except newer updatedAt → no meaningful divergence → no conflict
    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              uuid: 'ex-div',
              name: 'Same',
              muscleGroup: 'arms',
              isCustom: true,
              updatedAt: 2,
              notes: 'a',
            },
          ],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );
    expect(await db.conflictLog.count()).toBe(0);

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              uuid: 'ex-div',
              name: 'Changed',
              muscleGroup: 'arms',
              isCustom: true,
              updatedAt: 3,
              notes: 'a',
            },
          ],
          workouts: [],
          workoutExercises: [],
          sets: [],
        },
      }),
    );
    expect(await db.conflictLog.count()).toBe(1);
  });

  it('propagates soft-delete via LWW', async () => {
    const manager = new SyncManager(noopProvider);
    await db.workouts.add({
      uuid: 'w-del',
      startedAt: 1,
      workoutDay: '2026-01-01',
      updatedAt: 5,
    });

    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [],
          workouts: [
            {
              uuid: 'w-del',
              startedAt: 1,
              workoutDay: '2026-01-01',
              updatedAt: 100,
              deletedAt: 100,
            },
          ],
          workoutExercises: [],
          sets: [],
        },
      }),
    );

    const w = await db.workouts.where('uuid').equals('w-del').first();
    expect(w?.deletedAt).toBe(100);
  });
});
