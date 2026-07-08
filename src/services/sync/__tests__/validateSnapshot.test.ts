import { describe, it, expect } from 'vitest';
import { validateSnapshot } from '../validateSnapshot';

const validSnapshot = {
  schemaVersion: 3,
  exportedAt: Date.now(),
  deviceId: 'device-1',
  data: {
    settings: [],
    exercises: [],
    workouts: [],
    workoutExercises: [],
    sets: [],
    workoutTemplates: [],
    conflictLog: [],
  },
};

describe('validateSnapshot', () => {
  it('accepts a valid snapshot', () => {
    const result = validateSnapshot(validSnapshot);
    expect(result.schemaVersion).toBe(3);
    expect(result.deviceId).toBe('device-1');
  });

  it('rejects non-object root', () => {
    expect(() => validateSnapshot(null)).toThrow(/root must be an object/);
    expect(() => validateSnapshot('x')).toThrow(/root must be an object/);
  });

  it('rejects schema version mismatch', () => {
    expect(() => validateSnapshot({ ...validSnapshot, schemaVersion: 99 })).toThrow(/Schema version mismatch/);
  });

  it('rejects missing deviceId', () => {
    expect(() => validateSnapshot({ ...validSnapshot, deviceId: '' })).toThrow(/deviceId/);
  });

  it('rejects missing data arrays', () => {
    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: { ...validSnapshot.data, workouts: undefined },
      }),
    ).toThrow(/workouts/);
  });

  it('allows optional workoutTemplates/conflictLog to be omitted', () => {
    const { workoutTemplates: _wt, conflictLog: _cl, ...data } = validSnapshot.data;
    void _wt;
    void _cl;
    const result = validateSnapshot({ ...validSnapshot, data });
    expect(result.data.exercises).toEqual([]);
  });

  it('rejects entities missing uuid or updatedAt', () => {
    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: {
          ...validSnapshot.data,
          workouts: [{ name: 'bad' }],
        },
      }),
    ).toThrow(/uuid/);

    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: {
          ...validSnapshot.data,
          exercises: [{ uuid: 'ex-1' }],
        },
      }),
    ).toThrow(/updatedAt/);
  });

  it('accepts timestamped entities', () => {
    const result = validateSnapshot({
      ...validSnapshot,
      data: {
        ...validSnapshot.data,
        exercises: [{ uuid: 'ex-1', updatedAt: 1, name: 'Squat', muscleGroup: 'legs', isCustom: false }],
      },
    });
    expect(result.data.exercises).toHaveLength(1);
  });

  it('rejects entity with non-numeric deletedAt', () => {
    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: {
          ...validSnapshot.data,
          exercises: [{ uuid: 'ex-1', updatedAt: 1, deletedAt: 'yesterday' }],
        },
      }),
    ).toThrow(/deletedAt/);
  });

  it('rejects set with non-numeric weight', () => {
    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: {
          ...validSnapshot.data,
          sets: [{ uuid: 'set-1', updatedAt: 1, weight: '100', reps: 5 }],
        },
      }),
    ).toThrow(/weight/);
  });

  it('rejects workout with invalid startedAt', () => {
    expect(() =>
      validateSnapshot({
        ...validSnapshot,
        data: {
          ...validSnapshot.data,
          workouts: [{ uuid: 'w-1', updatedAt: 1, startedAt: 'not-a-number' }],
        },
      }),
    ).toThrow(/startedAt/);
  });

  it('accepts valid set and workout with optional fields', () => {
    const result = validateSnapshot({
      ...validSnapshot,
      data: {
        ...validSnapshot.data,
        workouts: [
          {
            uuid: 'w-1',
            updatedAt: 1,
            startedAt: Date.now(),
            workoutDay: 'push',
          },
        ],
        sets: [
          {
            uuid: 'set-1',
            updatedAt: 1,
            weight: 100,
            reps: 5,
          },
        ],
        exercises: [
          {
            uuid: 'ex-1',
            updatedAt: 1,
            name: 'Bench Press',
            isCustom: true,
          },
        ],
      },
    });
    expect(result.data.workouts).toHaveLength(1);
    expect(result.data.sets).toHaveLength(1);
    expect(result.data.exercises).toHaveLength(1);
  });
});
