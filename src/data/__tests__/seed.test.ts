import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { CATALOG_VERSION, DEFAULT_EXERCISES, ensureCatalog, seedDefaults } from '../seed';
import { nowMonotonic, resetMonotonicClock } from '../clock';
import { resetTestDatabase } from '../../test-utils/db';

describe('seedDefaults', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('inserts the built-in catalog', async () => {
    await db.delete();
    await db.open(); // populate → seedDefaults
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
    expect(await db.workoutTemplates.count()).toBe(3);
    expect(await db.settings.count()).toBe(1);
  });

  it('creates referenced template exercises', async () => {
    await seedDefaults(db);
    const templates = await db.workoutTemplates.toArray();
    const exerciseUuids = new Set((await db.exercises.toArray()).map(exercise => exercise.uuid));
    for (const template of templates) {
      expect(template.exercises.length).toBeGreaterThan(0);
      for (const uuid of template.exercises) {
        expect(exerciseUuids.has(uuid)).toBe(true);
      }
    }
  });
});

describe('ensureCatalog', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  /**
   * Regression: the catalog used to be seeded only by the Dexie `populate` event, so
   * existing installs never received built-in exercises added in a later release.
   */
  it('adds built-ins that are missing on an existing install', async () => {
    const existing = DEFAULT_EXERCISES[0];
    await db.exercises.add({
      uuid: 'ex-existing',
      name: existing.name,
      muscleGroup: existing.muscleGroup,
      isCustom: false,
      updatedAt: 1,
    });
    await db.settings.add({
      massUnit: 'kg',
      weightStep: 2.5,
      defaultRPEType: 'rpe',
      theme: 'dark',
      language: 'en',
      catalogVersion: 0,
      updatedAt: 1,
    });

    await ensureCatalog(db);

    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
    // The pre-existing row is untouched (same uuid, not duplicated).
    const preserved = await db.exercises.where('uuid').equals('ex-existing').first();
    expect(preserved).toBeTruthy();
    const settings = await db.settings.toCollection().first();
    expect(settings?.catalogVersion).toBe(CATALOG_VERSION);
  });

  it('is a no-op once the catalog version is current', async () => {
    await ensureCatalog(db); // seeds settings with the current version
    const before = await db.exercises.count();

    await ensureCatalog(db);
    await ensureCatalog(db);

    expect(await db.exercises.count()).toBe(before);
  });
});

/**
 * Regression: seeding used `Date.now()` directly, so a device whose clock was corrected
 * backwards stamped freshly seeded rows with timestamps that lose to older remote rows
 * under LWW. Seeded `updatedAt` must come from the monotonic clock.
 */
describe('seed timestamps', () => {
  beforeEach(async () => {
    resetMonotonicClock();
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMonotonicClock();
  });

  it('seedDefaults stamps rows no older than a previously issued monotonic timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const before = nowMonotonic(); // 1000

    vi.spyOn(Date, 'now').mockReturnValue(500); // wall clock jumps back
    await seedDefaults(db);

    const settings = await db.settings.toCollection().first();
    const exercises = await db.exercises.toArray();
    const templates = await db.workoutTemplates.toArray();
    for (const row of [settings, ...exercises, ...templates]) {
      expect(row!.updatedAt).toBeGreaterThanOrEqual(before);
    }
  });

  it('ensureCatalog stamps upserted rows no older than a previously issued monotonic timestamp', async () => {
    const existing = DEFAULT_EXERCISES[0];
    await db.exercises.add({
      uuid: 'ex-existing',
      name: existing.name,
      muscleGroup: existing.muscleGroup,
      isCustom: false,
      updatedAt: 1,
    });
    await db.settings.add({
      massUnit: 'kg',
      weightStep: 2.5,
      defaultRPEType: 'rpe',
      theme: 'dark',
      language: 'en',
      catalogVersion: 0,
      updatedAt: 1,
    });

    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const before = nowMonotonic(); // 1000

    vi.spyOn(Date, 'now').mockReturnValue(500); // wall clock jumps back
    await ensureCatalog(db);

    const settings = await db.settings.toCollection().first();
    expect(settings!.updatedAt).toBeGreaterThanOrEqual(before);
    const added = await db.exercises.where('uuid').notEqual('ex-existing').toArray();
    expect(added.length).toBe(DEFAULT_EXERCISES.length - 1);
    for (const exercise of added) {
      expect(exercise.updatedAt).toBeGreaterThanOrEqual(before);
    }
  });
});
