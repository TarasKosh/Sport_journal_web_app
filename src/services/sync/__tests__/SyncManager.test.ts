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

  it('equal updatedAt with an identical payload keeps local and logs no conflict', async () => {
    const manager = new SyncManager(noopProvider);
    await db.exercises.add({
      uuid: 'ex-eq',
      name: 'Local Keep',
      muscleGroup: 'legs',
      isCustom: true,
      aliases: [],
      variations: [],
      updatedAt: 15,
    });

    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            {
              uuid: 'ex-eq',
              name: 'Local Keep',
              muscleGroup: 'legs',
              isCustom: true,
              aliases: [],
              variations: [],
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
    expect(report.conflicts).toBe(0);
    expect(await db.conflictLog.count()).toBe(0);
  });

  /**
   * Regression: the previous rule kept the local copy when `updatedAt` values were equal, so
   * two devices that edited the same record in the same millisecond kept their own version
   * forever. The tie-break is now content-based, hence order-independent.
   */
  it('equal updatedAt with divergent payloads converges on both devices', async () => {
    const snapshotFor = (name: string): SyncSnapshot => emptySnapshot({
      data: {
        settings: [],
        exercises: [
          { uuid: 'ex-tie', name, muscleGroup: 'arms', isCustom: true, aliases: [], variations: [], updatedAt: 7 },
        ],
        workouts: [],
        workoutExercises: [],
        sets: [],
      },
    });

    // Device A holds 'Alpha'; device B holds 'Beta'; both stamped updatedAt = 7.
    const managerA = new SyncManager(noopProvider);
    await db.exercises.add({ uuid: 'ex-tie', name: 'Alpha', muscleGroup: 'arms', isCustom: true, updatedAt: 7 });
    await managerA.mergeSnapshot(snapshotFor('Beta'));
    const afterA = await db.exercises.where('uuid').equals('ex-tie').first();

    // Same conflict seen from the other side.
    await resetDb();
    const managerB = new SyncManager(noopProvider);
    await db.exercises.add({ uuid: 'ex-tie', name: 'Beta', muscleGroup: 'arms', isCustom: true, updatedAt: 7 });
    await managerB.mergeSnapshot(snapshotFor('Alpha'));
    const afterB = await db.exercises.where('uuid').equals('ex-tie').first();

    expect(afterA?.name).toBe(afterB?.name);
    // The loser is recorded so the overwrite is never silent.
    expect(await db.conflictLog.count()).toBe(1);
  });

  it('settings LWW: remote newer overwrites, equal timestamps converge deterministically', async () => {
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

    // Equal timestamps + divergent payload: the tie-break decides, and both devices agree.
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

    const afterMergeA = await db.settings.toCollection().first();

    await resetDb();
    const mirrored = new SyncManager(noopProvider);
    await db.settings.add({
      massUnit: MassUnit.KG,
      weightStep: 1,
      defaultRPEType: RPEType.RPE,
      theme: 'system',
      language: 'en',
      updatedAt: 50,
    });
    await mirrored.mergeSnapshot(
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
    settings = await db.settings.toCollection().first();

    expect(afterMergeA?.massUnit).toBe(settings?.massUnit);
    expect(afterMergeA?.theme).toBe(settings?.theme);
  });

  /**
   * `catalogVersion` is device-local bookkeeping (see DERIVED_FIELDS): a winning remote
   * settings row must not carry the remote device's value over, or `ensureCatalog()` would
   * re-run (or skip a due run) on the next launch.
   */
  it('keeps the local catalogVersion when a remote settings row wins', async () => {
    const manager = new SyncManager(noopProvider);
    await db.settings.add({
      massUnit: MassUnit.KG,
      weightStep: 2.5,
      defaultRPEType: RPEType.RPE,
      theme: 'dark',
      language: 'en',
      catalogVersion: 1,
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
              catalogVersion: 0,
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

    const settings = await db.settings.toCollection().first();
    expect(settings?.massUnit).toBe(MassUnit.LB);
    expect(settings?.updatedAt).toBe(50);
    expect(settings?.catalogVersion).toBe(1);
  });

  it('adds a settings row without importing remote ids or catalog bookkeeping', async () => {
    const manager = new SyncManager(noopProvider);

    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [
            {
              id: 77,
              massUnit: MassUnit.LB,
              weightStep: 5,
              defaultRPEType: RPEType.RIR,
              theme: 'light',
              language: 'en',
              catalogVersion: 3,
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

    const settings = await db.settings.toCollection().first();
    expect(report.added).toBe(1);
    expect(settings?.massUnit).toBe(MassUnit.LB);
    // The local row gets its own auto-increment id, like every other merge path.
    expect(settings?.id).not.toBe(77);
    // This device has not applied catalog v3 itself; ensureCatalog decides on next launch.
    expect(settings?.catalogVersion).toBeUndefined();
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
    // Status is derived on merge, so the row leaves every indexed query.
    expect(w?.status).toBe('deleted');
  });

  it('batches a large merge and keeps every row', async () => {
    const manager = new SyncManager(noopProvider);
    const exercises = Array.from({ length: 450 }, (_, index) => ({
      uuid: `ex-batch-${index}`,
      name: `Exercise ${index}`,
      muscleGroup: 'back' as const,
      isCustom: true,
      updatedAt: 10,
    }));

    const report = await manager.mergeSnapshot(
      emptySnapshot({ data: { settings: [], exercises, workouts: [], workoutExercises: [], sets: [] } }),
    );

    expect(report.added).toBe(450);
    expect(await db.exercises.count()).toBe(450);
  });

  it('skips rows whose parent is unknown and reports them', async () => {
    const manager = new SyncManager(noopProvider);

    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [],
          workouts: [],
          workoutExercises: [
            { uuid: 'we-orphan', workoutId: 'w-missing', exerciseId: 'ex-1', order: 0, updatedAt: 5 },
          ],
          sets: [
            { uuid: 'set-orphan', workoutExerciseId: 'we-missing', order: 0, weight: 100, reps: 5, isWarmup: false, isFailure: false, updatedAt: 5 },
          ],
        },
      }),
    );

    expect(report.skippedOrphans).toBe(2);
    expect(await db.workoutExercises.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });

  /**
   * Regression: sets used to be orphan-filtered against db.workoutExercises BEFORE the
   * snapshot's workout-exercises were merged, so a set whose parent arrived in the same
   * snapshot was dropped. On a fresh device (empty DB) that discarded every set.
   */
  it('persists sets whose parent workout-exercises arrive in the same snapshot', async () => {
    const manager = new SyncManager(noopProvider);

    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [
            { uuid: 'ex-fresh', name: 'Fresh Press', muscleGroup: 'chest', isCustom: true, aliases: [], variations: [], updatedAt: 10 },
          ],
          workouts: [
            { uuid: 'w-fresh', startedAt: 1000, workoutDay: '2026-01-01', endedAt: 2000, updatedAt: 10 },
          ],
          workoutExercises: [
            { uuid: 'we-fresh', workoutId: 'w-fresh', exerciseId: 'ex-fresh', order: 0, updatedAt: 10 },
          ],
          sets: [
            { uuid: 'set-fresh', workoutExerciseId: 'we-fresh', order: 0, weight: 100, reps: 5, isWarmup: false, isFailure: false, updatedAt: 10 },
          ],
        },
      }),
    );

    expect(report.skippedOrphans).toBe(0);
    const set = await db.sets.where('uuid').equals('set-fresh').first();
    expect(set).toBeTruthy();
    // Denormalized parent keys are filled in from the snapshot's workout-exercise.
    expect(set?.workoutId).toBe('w-fresh');
    expect(set?.exerciseId).toBe('ex-fresh');

    const workout = await db.workouts.where('uuid').equals('w-fresh').first();
    expect(workout?.setsCount).toBe(1);
  });

  /**
   * Regression: the normalize context for merged sets was built only from the snapshot's
   * workout-exercises. A set whose parent stayed behind on this device (unchanged since the
   * previous sync, so not part of the snapshot) merged without its denormalized
   * `exerciseId`/`workoutId`, leaving the `[exerciseId+performedAt]` index unusable.
   */
  it('backfills set parent keys from a workout-exercise that exists only locally', async () => {
    await db.workouts.add({
      uuid: 'w-localparent',
      startedAt: 1000,
      workoutDay: '2026-01-01',
      endedAt: 2000,
      status: 'finished',
      updatedAt: 1,
    });
    await db.workoutExercises.add({
      uuid: 'we-localparent',
      workoutId: 'w-localparent',
      exerciseId: 'ex-localparent',
      order: 0,
      updatedAt: 1,
    });

    const manager = new SyncManager(noopProvider);
    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [],
          workouts: [],
          workoutExercises: [],
          sets: [
            { uuid: 'set-localparent', workoutExerciseId: 'we-localparent', order: 0, weight: 100, reps: 5, isWarmup: false, isFailure: false, updatedAt: 10 },
          ],
        },
      }),
    );

    expect(report.skippedOrphans).toBe(0);
    const set = await db.sets.where('uuid').equals('set-localparent').first();
    expect(set).toBeTruthy();
    expect(set?.workoutId).toBe('w-localparent');
    expect(set?.exerciseId).toBe('ex-localparent');
  });

  it('still skips a set whose parent workout-exercise is unknown everywhere', async () => {
    const manager = new SyncManager(noopProvider);

    const report = await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [],
          workouts: [
            { uuid: 'w-known', startedAt: 1000, workoutDay: '2026-01-01', updatedAt: 10 },
          ],
          workoutExercises: [],
          sets: [
            { uuid: 'set-unknown-parent', workoutExerciseId: 'we-nowhere', order: 0, weight: 100, reps: 5, isWarmup: false, isFailure: false, updatedAt: 10 },
          ],
        },
      }),
    );

    expect(report.skippedOrphans).toBe(1);
    expect(await db.sets.count()).toBe(0);
  });

  it('recounts workout aggregates for merged sets', async () => {
    await db.workouts.add({
      uuid: 'w-agg',
      startedAt: 1000,
      workoutDay: '2026-01-01',
      status: 'finished',
      endedAt: 2000,
      setsCount: 0,
      totalTonnage: 0,
      exerciseCount: 0,
      updatedAt: 1,
    });
    await db.workoutExercises.add({
      uuid: 'we-agg',
      workoutId: 'w-agg',
      exerciseId: 'ex-agg',
      order: 0,
      updatedAt: 1,
    });

    const manager = new SyncManager(noopProvider);
    await manager.mergeSnapshot(
      emptySnapshot({
        data: {
          settings: [],
          exercises: [],
          workouts: [],
          workoutExercises: [],
          // Parent is not part of the snapshot: it exists locally only.
          sets: [
            { uuid: 'set-agg', workoutExerciseId: 'we-agg', order: 0, weight: 100, reps: 5, isWarmup: false, isFailure: false, updatedAt: 10 },
          ],
        },
      }),
    );

    const workout = await db.workouts.where('uuid').equals('w-agg').first();
    expect(workout?.setsCount).toBe(1);
    expect(workout?.totalTonnage).toBe(500);
  });

  it('prunes conflict log entries older than the retention window', async () => {
    const stale = Date.now() - 365 * 24 * 60 * 60 * 1000;
    await db.conflictLog.add({
      uuid: 'conflict-old',
      entityType: 'exercise',
      entityId: 'ex-1',
      localUpdatedAt: 1,
      remoteUpdatedAt: 2,
      resolvedAt: stale,
      resolution: 'remote',
    });

    const manager = new SyncManager(noopProvider);
    await manager.mergeSnapshot(emptySnapshot());

    expect(await db.conflictLog.count()).toBe(0);
  });
});

describe('SyncManager.sync', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects a concurrent sync instead of interleaving two merges', async () => {
    let releasePull: (() => void) | undefined;
    const gate = new Promise<void>(resolve => {
      releasePull = resolve;
    });

    const provider: SyncProvider = {
      ...noopProvider,
      async pull() {
        await gate;
        return null;
      },
    };

    const manager = new SyncManager(provider);
    const first = manager.sync();
    await expect(manager.sync()).rejects.toThrow(/already running/i);
    releasePull?.();
    await first;
  });

  it('returns the merge report from the pulled snapshot', async () => {
    const pushed: SyncSnapshot[] = [];
    const provider: SyncProvider = {
      ...noopProvider,
      async pull() {
        return emptySnapshot({
          data: {
            settings: [],
            exercises: [
              { uuid: 'ex-sync', name: 'Sync Press', muscleGroup: 'chest', isCustom: true, updatedAt: 10 },
            ],
            workouts: [],
            workoutExercises: [
              { uuid: 'we-sync-orphan', workoutId: 'w-missing', exerciseId: 'ex-sync', order: 0, updatedAt: 10 },
            ],
            sets: [],
          },
        });
      },
      async push(snapshot) {
        pushed.push(snapshot);
      },
    };

    const manager = new SyncManager(provider);
    const report = await manager.sync();

    // The UI relies on these counts to warn about skipped orphans after a sync.
    expect(report.added).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.conflicts).toBe(0);
    expect(report.skippedOrphans).toBe(1);
    expect(pushed).toHaveLength(1);
  });
});
