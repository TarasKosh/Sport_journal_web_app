import { describe, expect, it } from 'vitest';
import { contentSignature, normalizeExercise, normalizeSet, normalizeWorkout } from '../normalize';
import type { SetEntry, Workout } from '../../types';

describe('normalizeWorkout', () => {
  it('derives workoutDay and status', () => {
    const workout: Workout = {
      uuid: 'w-1',
      startedAt: new Date(2026, 0, 2, 10, 0, 0).getTime(),
      workoutDay: '',
      endedAt: 123,
      updatedAt: 1,
    };

    const normalized = normalizeWorkout(workout);
    expect(normalized.workoutDay).toBe('2026-01-02');
    expect(normalized.status).toBe('finished');
  });

  it('soft-delete wins over finished', () => {
    const normalized = normalizeWorkout({
      uuid: 'w-2',
      startedAt: 1,
      workoutDay: '2026-01-02',
      endedAt: 5,
      deletedAt: 9,
      updatedAt: 9,
    });
    expect(normalized.status).toBe('deleted');
  });

  it('repairs a missing startedAt instead of writing NaN', () => {
    const normalized = normalizeWorkout({ uuid: 'w-3', workoutDay: '2026-01-02', updatedAt: 1 } as Workout);
    expect(Number.isFinite(normalized.startedAt)).toBe(true);
  });
});

describe('normalizeSet', () => {
  it('denormalizes parent keys and the workout timestamp', () => {
    const set: SetEntry = {
      uuid: 's-1',
      workoutExerciseId: 'we-1',
      order: 0,
      weight: 100,
      reps: 5,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    };

    const normalized = normalizeSet(set, {
      workoutExercise: { uuid: 'we-1', exerciseId: 'ex-1', workoutId: 'w-1' },
      workoutStartedAt: 777,
    });

    expect(normalized.exerciseId).toBe('ex-1');
    expect(normalized.workoutId).toBe('w-1');
    expect(normalized.performedAt).toBe(777);
  });

  it('keeps values that are already present', () => {
    const set: SetEntry = {
      uuid: 's-2',
      workoutExerciseId: 'we-2',
      exerciseId: 'ex-own',
      workoutId: 'w-own',
      performedAt: 5,
      order: 0,
      weight: 1,
      reps: 1,
      isWarmup: false,
      isFailure: false,
      updatedAt: 1,
    };
    const normalized = normalizeSet(set, {
      workoutExercise: { uuid: 'we-2', exerciseId: 'ex-other', workoutId: 'w-other' },
      workoutStartedAt: 9,
    });
    expect(normalized.exerciseId).toBe('ex-own');
    expect(normalized.workoutId).toBe('w-own');
    expect(normalized.performedAt).toBe(5);
  });
});

describe('normalizeExercise', () => {
  it('fills array fields so comparisons are apples-to-apples', () => {
    const normalized = normalizeExercise({
      uuid: 'ex-1',
      name: 'Squat',
      muscleGroup: 'legs',
      isCustom: false,
      updatedAt: 1,
    });
    expect(normalized.aliases).toEqual([]);
    expect(normalized.variations).toEqual([]);
  });
});

describe('contentSignature', () => {
  it('ignores derived and sync fields', () => {
    const base = { uuid: 'w-1', title: 'Push', updatedAt: 1 };
    const withDerived = {
      ...base,
      id: 42,
      updatedAt: 999,
      status: 'finished',
      setsCount: 12,
      totalTonnage: 5000,
      exerciseCount: 4,
    };
    expect(contentSignature(withDerived)).toBe(contentSignature(base));
  });

  it('reflects user-authored changes', () => {
    expect(contentSignature({ uuid: 'w-1', title: 'Push' }))
      .not.toBe(contentSignature({ uuid: 'w-1', title: 'Pull' }));
  });

  /**
   * Regression: `workoutDay` is derived from `startedAt` in local time, so two devices in
   * different timezones normalize the same legacy row to different day strings. If that
   * difference counted as content divergence, every first sync logged a spurious conflict.
   */
  it('ignores workoutDay differences between otherwise equal records', () => {
    const localMidnight = {
      uuid: 'w-1',
      startedAt: 123,
      endedAt: 456,
      updatedAt: 1,
      workoutDay: '2026-01-02',
    };
    const otherTimezone = { ...localMidnight, workoutDay: '2026-01-01' };
    expect(contentSignature(localMidnight)).toBe(contentSignature(otherTimezone));
  });

  it('is key-order independent', () => {
    expect(contentSignature({ a: 1, b: 2 })).toBe(contentSignature({ b: 2, a: 1 }));
  });
});
