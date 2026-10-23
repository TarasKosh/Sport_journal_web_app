import type { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { ConflictLog, Settings, WorkoutExercise } from '../../types';
import type { SyncSnapshot, SyncProvider } from './types';
import { SCHEMA_VERSION, validateSnapshot } from './validateSnapshot';
import { recountWorkouts } from '../../data/aggregates';
import { nowMonotonic } from '../../data/clock';
import {
    contentSignature,
    normalizeExercise,
    normalizeSet,
    normalizeTemplate,
    normalizeWorkout,
    normalizeWorkoutExercise,
} from '../../data/normalize';
import { fetchByAnyOf } from '../../data/queries/anyOf';
import { ConflictRepository } from '../../data/repositories/ConflictRepository';

type TimestampedSyncRecord = {
    id?: number;
    uuid: string;
    updatedAt: number;
    deletedAt?: number;
};

export type MergeReport = {
    added: number;
    updated: number;
    conflicts: number;
    /** Remote rows dropped because their parent row is unknown (referential integrity). */
    skippedOrphans: number;
};

type Winner = { winner: 'local' | 'remote'; diverged: boolean };

/**
 * Last-write-wins decision.
 *
 * When `updatedAt` values are equal but payloads differ, the old code kept the local copy on
 * both devices — each side kept its own version and they never converged. A stable
 * content-based tie-break makes both devices pick the same winner regardless of sync order.
 */
export function decideWinner<T extends TimestampedSyncRecord>(local: T, remote: T): Winner {
    const localSignature = contentSignature(local as unknown as Record<string, unknown>);
    const remoteSignature = contentSignature(remote as unknown as Record<string, unknown>);
    const diverged = localSignature !== remoteSignature;

    if (remote.updatedAt !== local.updatedAt) {
        return { winner: remote.updatedAt > local.updatedAt ? 'remote' : 'local', diverged };
    }
    if (!diverged) return { winner: 'local', diverged: false };

    return { winner: remoteSignature > localSignature ? 'remote' : 'local', diverged: true };
}

/** Chunked uuid lookup, so a merge never builds one giant `anyOf` query. */
async function existingUuids<T extends { uuid: string }>(
    table: Table<T, number>,
    uuids: string[],
): Promise<Set<string>> {
    const rows = await fetchByAnyOf<T>(keys => table.where('uuid').anyOf(keys), uuids);
    return new Set(rows.map(row => row.uuid));
}

let syncInFlight: Promise<MergeReport> | null = null;

/**
 * Serialises syncs: two tabs (or a double tap) used to pull, merge and push concurrently,
 * producing snapshots from a partially merged database.
 */
async function withSyncLock(task: () => Promise<MergeReport>): Promise<MergeReport> {
    if (syncInFlight) {
        throw new Error('A sync is already running.');
    }

    const run = (async () => {
        try {
            const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
            if (locks?.request) {
                return await locks.request('strength-journal-sync', { ifAvailable: true }, async lock => {
                    if (!lock) throw new Error('Another tab is syncing. Try again in a moment.');
                    return task();
                });
            }
            return await task();
        } finally {
            syncInFlight = null;
        }
    })();

    syncInFlight = run;
    return run;
}

export class SyncManager {
    private provider: SyncProvider;
    private deviceId: string;

    constructor(provider: SyncProvider) {
        this.provider = provider;
        this.deviceId = localStorage.getItem('deviceId') || uuidv4();
        localStorage.setItem('deviceId', this.deviceId);
    }

    /**
     * Reads the whole database inside one read transaction, so a concurrent write cannot
     * produce a snapshot that mixes states from before and after it.
     */
    async createSnapshot(): Promise<SyncSnapshot> {
        return db.transaction(
            'r',
            [db.settings, db.exercises, db.workouts, db.workoutExercises, db.sets, db.workoutTemplates, db.conflictLog],
            async () => {
                const [settings, exercises, workouts, workoutExercises, sets, workoutTemplates, conflictLog] =
                    await Promise.all([
                        db.settings.toArray(),
                        db.exercises.toArray(),
                        db.workouts.toArray(),
                        db.workoutExercises.toArray(),
                        db.sets.toArray(),
                        db.workoutTemplates.toArray(),
                        db.conflictLog.toArray(),
                    ]);

                return {
                    schemaVersion: SCHEMA_VERSION,
                    exportedAt: Date.now(),
                    deviceId: this.deviceId,
                    data: {
                        settings,
                        exercises,
                        workouts,
                        workoutExercises,
                        sets,
                        workoutTemplates,
                        conflictLog,
                    },
                };
            },
        );
    }

    async mergeSnapshot(remote: SyncSnapshot | unknown): Promise<MergeReport> {
        const snapshot = validateSnapshot(remote, SCHEMA_VERSION);
        const report: MergeReport = { added: 0, updated: 0, conflicts: 0, skippedOrphans: 0 };

        await db.transaction(
            'rw',
            [db.settings, db.exercises, db.workouts, db.workoutExercises, db.sets, db.workoutTemplates, db.conflictLog],
            async () => {
                await this.mergeSettings(snapshot.data.settings || [], report);

                const exercises = (snapshot.data.exercises ?? []).map(normalizeExercise);
                const workouts = (snapshot.data.workouts ?? []).map(normalizeWorkout);

                await this.mergeTable(db.exercises, exercises, 'exercise', report, normalizeExercise);
                const mergedWorkouts = await this.mergeTable(db.workouts, workouts, 'workout', report, normalizeWorkout);

                // Referential integrity: never import a row whose parent is unknown, otherwise it
                // becomes invisible (never rendered, never counted) and bloats every next snapshot.
                const remoteWorkoutExercises = (snapshot.data.workoutExercises ?? []).map(normalizeWorkoutExercise);
                const knownWorkoutUuids = await existingUuids(
                    db.workouts,
                    [...new Set(remoteWorkoutExercises.map(row => row.workoutId))],
                );
                const workoutExercises = remoteWorkoutExercises.filter(row => knownWorkoutUuids.has(row.workoutId));
                report.skippedOrphans += remoteWorkoutExercises.length - workoutExercises.length;

                const parentByUuid = new Map(workoutExercises.map(row => [row.uuid, row]));
                const remoteSets = (snapshot.data.sets ?? []).map(set =>
                    normalizeSet(set, { workoutExercise: parentByUuid.get(set.workoutExerciseId) }),
                );
                const knownWorkoutExerciseUuids = await existingUuids(
                    db.workoutExercises,
                    [...new Set(remoteSets.map(row => row.workoutExerciseId))],
                );
                // A set's parent may be new in this very snapshot (db.workoutExercises is merged
                // only after this filter), so parents that survived the workout-level orphan
                // filter count as known too. Without this, a fresh device dropped every set.
                for (const row of workoutExercises) knownWorkoutExerciseUuids.add(row.uuid);
                const sets = remoteSets.filter(row => knownWorkoutExerciseUuids.has(row.workoutExerciseId));
                report.skippedOrphans += remoteSets.length - sets.length;

                const mergedWorkoutExercises = await this.mergeTable(
                    db.workoutExercises,
                    workoutExercises,
                    'workout_exercise',
                    report,
                    normalizeWorkoutExercise,
                );
                const mergedSets = await this.mergeTable(db.sets, sets, 'set', report, record => normalizeSet(record));

                await this.mergeTable(
                    db.workoutTemplates,
                    (snapshot.data.workoutTemplates ?? []).map(normalizeTemplate),
                    'workout_template',
                    report,
                    normalizeTemplate,
                );

                await this.mergeConflictLog(snapshot.data.conflictLog || []);

                // Derived aggregate caches are per-device, so recompute them for every workout
                // the merge touched instead of trusting the peer's numbers.
                const touchedWorkouts = new Set<string>();
                for (const workout of mergedWorkouts) touchedWorkouts.add(workout.uuid);
                for (const row of mergedWorkoutExercises) touchedWorkouts.add(row.workoutId);
                for (const row of mergedSets) {
                    if (row.workoutId) touchedWorkouts.add(row.workoutId);
                }
                // A peer may send a set whose parent workout-exercise already exists locally
                // (unchanged since the previous sync), so resolve those parents too.
                const setParents = await fetchByAnyOf<WorkoutExercise>(
                    keys => db.workoutExercises.where('uuid').anyOf(keys),
                    mergedSets.map(row => row.workoutExerciseId),
                );
                for (const parent of setParents) touchedWorkouts.add(parent.workoutId);

                await recountWorkouts(touchedWorkouts);
            },
        );

        // The conflict log travels in every snapshot; keep it bounded.
        await ConflictRepository.pruneOlderThan();

        // Skipped orphans mean data was silently dropped; make that diagnosable outside the UI.
        if (report.skippedOrphans > 0) {
            console.warn(`mergeSnapshot skipped ${report.skippedOrphans} orphaned row(s) whose parent record is missing`);
        }

        return report;
    }

    private async mergeSettings(remoteSettings: Settings[], report: MergeReport): Promise<void> {
        const remote = remoteSettings[0];
        if (!remote) return;

        const local = await db.settings.toCollection().first();
        if (!local) {
            await db.settings.add({ ...remote, updatedAt: remote.updatedAt ?? nowMonotonic() });
            report.added += 1;
            return;
        }

        const localUpdated = local.updatedAt ?? 0;
        const remoteUpdated = remote.updatedAt ?? 0;
        const decision = decideWinner(
            { uuid: 'settings', updatedAt: localUpdated, ...local } as TimestampedSyncRecord,
            { uuid: 'settings', updatedAt: remoteUpdated, ...remote } as TimestampedSyncRecord,
        );

        if (decision.winner !== 'remote') return;

        if (decision.diverged && localUpdated > 0) {
            await this.logConflict('settings', 'settings', localUpdated, remoteUpdated, { local, remote }, 'remote');
            report.conflicts += 1;
        }

        await db.settings.put({
            ...remote,
            id: local.id ?? remote.id ?? 1,
            updatedAt: remoteUpdated,
        });
        report.updated += 1;
    }

    private async logConflict(
        entityType: ConflictLog['entityType'],
        entityId: string,
        localUpdatedAt: number,
        remoteUpdatedAt: number,
        snapshot: Record<string, unknown>,
        resolution: 'remote' | 'local',
    ): Promise<void> {
        await db.conflictLog.add({
            uuid: uuidv4(),
            entityType,
            entityId,
            localUpdatedAt,
            remoteUpdatedAt,
            resolvedAt: nowMonotonic(),
            resolution,
            snapshot,
        });
    }

    /**
     * Merges a batch of remote rows and returns the rows that ended up local.
     * `normalize` is applied to both sides before comparison: a remote record that arrives
     * with defaults filled in (e.g. `aliases: []`) must not look like a conflict against an
     * equivalent local row that predates those defaults.
     */
    private async mergeTable<T extends TimestampedSyncRecord>(
        table: Table<T, number>,
        remoteRecords: T[],
        entityType: ConflictLog['entityType'],
        report: MergeReport,
        normalize: (record: T) => T = record => record,
    ): Promise<T[]> {
        if (remoteRecords.length === 0) return [];

        const remoteByUuid = new Map(remoteRecords.map(record => [record.uuid, record]));
        const applied: T[] = [];

        for (const uuids of chunk([...remoteByUuid.keys()])) {
            const localRows = await table.where('uuid').anyOf(uuids).toArray();
            const localByUuid = new Map(localRows.map(row => [row.uuid, row]));
            const toPut: T[] = [];
            const conflicts: ConflictLog[] = [];

            for (const uuid of uuids) {
                const remoteRaw = remoteByUuid.get(uuid);
                if (!remoteRaw) continue;
                const remote = normalize(remoteRaw);
                const localRaw = localByUuid.get(uuid);
                const local = localRaw ? normalize(localRaw) : undefined;

                if (!local) {
                    const { id: _remoteId, ...rest } = remote as T & { id?: number };
                    void _remoteId;
                    const inserted = rest as T;
                    toPut.push(inserted);
                    applied.push(inserted);
                    report.added += 1;
                    continue;
                }

                const decision = decideWinner(local, remote);
                if (decision.diverged) {
                    conflicts.push({
                        uuid: uuidv4(),
                        entityType,
                        entityId: remote.uuid,
                        localUpdatedAt: local.updatedAt,
                        remoteUpdatedAt: remote.updatedAt,
                        resolvedAt: nowMonotonic(),
                        resolution: decision.winner,
                        snapshot: { local: localRaw, remote: remoteRaw } as unknown as Record<string, unknown>,
                    });
                    report.conflicts += 1;
                }

                if (decision.winner === 'remote') {
                    const merged = { ...remote, id: localRaw?.id };
                    toPut.push(merged);
                    applied.push(merged);
                    report.updated += 1;
                }
            }

            if (toPut.length > 0) await table.bulkPut(toPut);
            if (conflicts.length > 0) await db.conflictLog.bulkAdd(conflicts);
        }

        return applied;
    }

    private async mergeConflictLog(remoteRecords: ConflictLog[]): Promise<void> {
        if (remoteRecords.length === 0) return;

        const remoteByUuid = new Map(remoteRecords.map(record => [record.uuid, record]));
        for (const uuids of chunk([...remoteByUuid.keys()])) {
            const localRows = await db.conflictLog.where('uuid').anyOf(uuids).toArray();
            const localByUuid = new Map(localRows.map(row => [row.uuid, row]));
            const toPut: ConflictLog[] = [];

            for (const uuid of uuids) {
                const remote = remoteByUuid.get(uuid);
                if (!remote) continue;
                const local = localByUuid.get(uuid);
                if (!local) {
                    const { id: _remoteId, ...rest } = remote;
                    void _remoteId;
                    toPut.push(rest as ConflictLog);
                    continue;
                }
                toPut.push({ ...remote, id: local.id });
            }

            if (toPut.length > 0) await db.conflictLog.bulkPut(toPut);
        }
    }

    async sync(): Promise<MergeReport> {
        return withSyncLock(async () => {
            if (!(await this.provider.isAuthenticated())) {
                await this.provider.connect();
            }

            let report: MergeReport = { added: 0, updated: 0, conflicts: 0, skippedOrphans: 0 };
            const remoteSnapshot = await this.provider.pull();
            if (remoteSnapshot) {
                report = await this.mergeSnapshot(remoteSnapshot);
            }

            const localSnapshot = await this.createSnapshot();
            await this.provider.push(localSnapshot);
            return report;
        });
    }
}

function chunk(keys: string[], size = 200): string[][] {
    const chunks: string[][] = [];
    for (let index = 0; index < keys.length; index += size) {
        chunks.push(keys.slice(index, index + size));
    }
    return chunks;
}
