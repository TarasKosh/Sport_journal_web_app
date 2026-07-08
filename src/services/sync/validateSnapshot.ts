import type { SyncSnapshot } from './types';

const SCHEMA_VERSION = 3;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function assertFiniteNumberIfPresent(
    item: Record<string, unknown>,
    field: string,
    path: string,
): void {
    const value = item[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
        throw new Error(`Invalid snapshot: ${path}.${field} must be a finite number when present.`);
    }
}

function assertTimestampedEntity(item: unknown, path: string): asserts item is Record<string, unknown> {
    if (!isObject(item)) {
        throw new Error(`Invalid snapshot: ${path} must be an object.`);
    }
    if (typeof item.uuid !== 'string' || item.uuid.length === 0) {
        throw new Error(`Invalid snapshot: ${path}.uuid must be a non-empty string.`);
    }
    if (typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) {
        throw new Error(`Invalid snapshot: ${path}.updatedAt must be a finite number.`);
    }
    assertFiniteNumberIfPresent(item, 'deletedAt', path);
}

function assertExerciseEntity(item: unknown, path: string): void {
    assertTimestampedEntity(item, path);
    if (item.name !== undefined && typeof item.name !== 'string') {
        throw new Error(`Invalid snapshot: ${path}.name must be a string when present.`);
    }
    if (item.isCustom !== undefined && typeof item.isCustom !== 'boolean') {
        throw new Error(`Invalid snapshot: ${path}.isCustom must be a boolean when present.`);
    }
}

function assertWorkoutEntity(item: unknown, path: string): void {
    assertTimestampedEntity(item, path);
    assertFiniteNumberIfPresent(item, 'startedAt', path);
    if (item.workoutDay !== undefined) {
        if (typeof item.workoutDay !== 'string' || item.workoutDay.length === 0) {
            throw new Error(`Invalid snapshot: ${path}.workoutDay must be a non-empty string when present.`);
        }
    }
}

function assertSetEntity(item: unknown, path: string): void {
    assertTimestampedEntity(item, path);
    assertFiniteNumberIfPresent(item, 'weight', path);
    assertFiniteNumberIfPresent(item, 'reps', path);
}

function assertSettingsEntity(item: unknown, path: string): void {
    if (!isObject(item)) {
        throw new Error(`Invalid snapshot: ${path} must be an object.`);
    }
    if (item.updatedAt !== undefined && (typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt))) {
        throw new Error(`Invalid snapshot: ${path}.updatedAt must be a finite number when present.`);
    }
    if (typeof item.massUnit !== 'string' && item.massUnit !== undefined) {
        throw new Error(`Invalid snapshot: ${path}.massUnit is invalid.`);
    }
}

/**
 * Validate a pulled/imported snapshot before merge.
 * Throws Error with a user-readable message on failure.
 */
export function validateSnapshot(raw: unknown, expectedSchemaVersion = SCHEMA_VERSION): SyncSnapshot {
    if (!isObject(raw)) {
        throw new Error('Invalid snapshot: root must be an object.');
    }

    if (raw.schemaVersion !== expectedSchemaVersion) {
        throw new Error(
            `Schema version mismatch. Local: ${expectedSchemaVersion}, Remote: ${String(raw.schemaVersion)}`,
        );
    }

    if (typeof raw.exportedAt !== 'number' || !Number.isFinite(raw.exportedAt)) {
        throw new Error('Invalid snapshot: exportedAt must be a number.');
    }

    if (typeof raw.deviceId !== 'string' || raw.deviceId.length === 0) {
        throw new Error('Invalid snapshot: deviceId must be a non-empty string.');
    }

    if (!isObject(raw.data)) {
        throw new Error('Invalid snapshot: data must be an object.');
    }

    const data = raw.data;
    const requiredArrays = ['settings', 'exercises', 'workouts', 'workoutExercises', 'sets'] as const;
    for (const key of requiredArrays) {
        if (!isArray(data[key])) {
            throw new Error(`Invalid snapshot: data.${key} must be an array.`);
        }
    }

    if (data.workoutTemplates !== undefined && !isArray(data.workoutTemplates)) {
        throw new Error('Invalid snapshot: data.workoutTemplates must be an array when present.');
    }

    if (data.conflictLog !== undefined && !isArray(data.conflictLog)) {
        throw new Error('Invalid snapshot: data.conflictLog must be an array when present.');
    }

    (data.settings as unknown[]).forEach((item, i) => assertSettingsEntity(item, `data.settings[${i}]`));

    (data.exercises as unknown[]).forEach((item, i) => assertExerciseEntity(item, `data.exercises[${i}]`));
    (data.workouts as unknown[]).forEach((item, i) => assertWorkoutEntity(item, `data.workouts[${i}]`));
    (data.workoutExercises as unknown[]).forEach((item, i) =>
        assertTimestampedEntity(item, `data.workoutExercises[${i}]`),
    );
    (data.sets as unknown[]).forEach((item, i) => assertSetEntity(item, `data.sets[${i}]`));

    if (isArray(data.workoutTemplates)) {
        data.workoutTemplates.forEach((item, i) => assertTimestampedEntity(item, `data.workoutTemplates[${i}]`));
    }

    if (isArray(data.conflictLog)) {
        data.conflictLog.forEach((item, i) => {
            if (!isObject(item)) {
                throw new Error(`Invalid snapshot: data.conflictLog[${i}] must be an object.`);
            }
            if (typeof item.uuid !== 'string' || item.uuid.length === 0) {
                throw new Error(`Invalid snapshot: data.conflictLog[${i}].uuid must be a non-empty string.`);
            }
        });
    }

    return raw as unknown as SyncSnapshot;
}

export { SCHEMA_VERSION };
