import type { SyncSnapshot } from './types';

const SCHEMA_VERSION = 3;

/** Oldest snapshot format this build can still read and migrate forward. */
const OLDEST_SUPPORTED_VERSION = 1;

type RawSnapshot = Record<string, unknown>;
type Migration = (raw: RawSnapshot) => RawSnapshot;

/**
 * Forward-migration chain, keyed by the version being migrated *from*.
 *
 * Additive changes (a new optional field) need no entry: unknown fields survive the merge
 * because records are stored whole. Add an entry here whenever a field is renamed, removed
 * or reinterpreted, and reachable old versions keep working instead of hard-failing the sync.
 */
const SNAPSHOT_MIGRATIONS: Record<number, Migration> = {};

function migrateSnapshot(raw: RawSnapshot, fromVersion: number): RawSnapshot {
    let current = raw;
    for (let version = fromVersion; version < SCHEMA_VERSION; version += 1) {
        const migrate = SNAPSHOT_MIGRATIONS[version];
        if (migrate) current = migrate(current);
    }
    return current;
}

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

function assertWorkoutExerciseEntity(item: unknown, path: string): void {
    assertTimestampedEntity(item, path);
    if (item.workoutId !== undefined && typeof item.workoutId !== 'string') {
        throw new Error(`Invalid snapshot: ${path}.workoutId must be a string when present.`);
    }
    if (item.exerciseId !== undefined && typeof item.exerciseId !== 'string') {
        throw new Error(`Invalid snapshot: ${path}.exerciseId must be a string when present.`);
    }
}

function assertSetEntity(item: unknown, path: string): void {
    assertTimestampedEntity(item, path);
    assertFiniteNumberIfPresent(item, 'weight', path);
    assertFiniteNumberIfPresent(item, 'reps', path);
    if (typeof item.workoutExerciseId !== 'string' || item.workoutExerciseId.length === 0) {
        throw new Error(`Invalid snapshot: ${path}.workoutExerciseId must be a non-empty string.`);
    }
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
 * Older supported versions are migrated forward; a newer version is rejected with a clear
 * message (unknown semantics must not be merged silently).
 * Throws Error with a user-readable message on failure.
 */
export function validateSnapshot(raw: unknown, expectedSchemaVersion = SCHEMA_VERSION): SyncSnapshot {
    if (!isObject(raw)) {
        throw new Error('Invalid snapshot: root must be an object.');
    }

    const rawVersion = raw.schemaVersion;
    if (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion)) {
        throw new Error('Schema version mismatch: snapshot has no valid schemaVersion.');
    }
    if (rawVersion > expectedSchemaVersion) {
        throw new Error(
            `Schema version mismatch: snapshot schema ${rawVersion} is newer than ${expectedSchemaVersion}. Update the app before importing.`,
        );
    }
    if (rawVersion < OLDEST_SUPPORTED_VERSION) {
        throw new Error(
            `Schema version mismatch: snapshot schema ${rawVersion} is older than the supported minimum ${OLDEST_SUPPORTED_VERSION}.`,
        );
    }

    const migrated = migrateSnapshot(raw, rawVersion);

    if (typeof migrated.exportedAt !== 'number' || !Number.isFinite(migrated.exportedAt)) {
        throw new Error('Invalid snapshot: exportedAt must be a number.');
    }

    if (typeof migrated.deviceId !== 'string' || migrated.deviceId.length === 0) {
        throw new Error('Invalid snapshot: deviceId must be a non-empty string.');
    }

    if (!isObject(migrated.data)) {
        throw new Error('Invalid snapshot: data must be an object.');
    }

    const data = migrated.data;
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
        assertWorkoutExerciseEntity(item, `data.workoutExercises[${i}]`),
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

    return { ...migrated, schemaVersion: expectedSchemaVersion } as unknown as SyncSnapshot;
}

export { SCHEMA_VERSION, OLDEST_SUPPORTED_VERSION };
