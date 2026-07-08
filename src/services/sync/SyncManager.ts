import type { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { ConflictLog, Settings } from '../../types';
import type { SyncSnapshot, SyncProvider } from './types';
import { SCHEMA_VERSION, validateSnapshot } from './validateSnapshot';

type TimestampedSyncRecord = {
    id?: number;
    uuid: string;
    updatedAt: number;
    deletedAt?: number;
};

/** True when payloads differ in a way that is meaningful beyond timestamps alone being unequal. */
function hasMeaningfulDivergence(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
): boolean {
    const ignore = new Set(['id', 'updatedAt']);
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
        if (ignore.has(key)) continue;
        if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
            return true;
        }
    }
    return false;
}

export class SyncManager {
    private provider: SyncProvider;
    private deviceId: string;

    constructor(provider: SyncProvider) {
        this.provider = provider;
        this.deviceId = localStorage.getItem('deviceId') || uuidv4();
        localStorage.setItem('deviceId', this.deviceId);
    }

    async createSnapshot(): Promise<SyncSnapshot> {
        const settings = await db.settings.toArray();
        const exercises = await db.exercises.toArray();
        const workouts = await db.workouts.toArray();
        const workoutExercises = await db.workoutExercises.toArray();
        const sets = await db.sets.toArray();
        const workoutTemplates = await db.workoutTemplates.toArray();
        const conflictLog = await db.conflictLog.toArray();

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
    }

    async mergeSnapshot(remote: SyncSnapshot | unknown): Promise<void> {
        const snapshot = validateSnapshot(remote, SCHEMA_VERSION);

        await db.transaction(
            'rw',
            [db.settings, db.exercises, db.workouts, db.workoutExercises, db.sets, db.workoutTemplates, db.conflictLog],
            async () => {
                await this.mergeSettings(snapshot.data.settings || []);
                await this.mergeTable(db.exercises, snapshot.data.exercises, 'exercise');
                await this.mergeTable(db.workouts, snapshot.data.workouts, 'workout');
                await this.mergeTable(db.workoutExercises, snapshot.data.workoutExercises, 'workout_exercise');
                await this.mergeTable(db.sets, snapshot.data.sets, 'set');
                await this.mergeTable(db.workoutTemplates, snapshot.data.workoutTemplates || [], 'workout_template');
                await this.mergeConflictLog(snapshot.data.conflictLog || []);
            },
        );
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
            resolvedAt: Date.now(),
            resolution,
            snapshot,
        });
    }

    private async mergeSettings(remoteSettings: Settings[]): Promise<void> {
        const remote = remoteSettings[0];
        if (!remote) {
            return;
        }

        const local = await db.settings.toCollection().first();
        const localUpdated = local?.updatedAt ?? 0;
        const remoteUpdated = remote.updatedAt ?? 0;

        if (!local) {
            await db.settings.add({
                ...remote,
                updatedAt: remoteUpdated || Date.now(),
            });
            return;
        }

        if (remoteUpdated > localUpdated) {
            if (
                localUpdated > 0 &&
                hasMeaningfulDivergence(
                    local as unknown as Record<string, unknown>,
                    remote as unknown as Record<string, unknown>,
                )
            ) {
                await this.logConflict(
                    'settings',
                    'settings',
                    localUpdated,
                    remoteUpdated,
                    { local, remote } as unknown as Record<string, unknown>,
                    'remote',
                );
            }
            await db.settings.put({
                ...remote,
                id: local.id ?? remote.id ?? 1,
                updatedAt: remoteUpdated,
            });
        }
        // else keep local (including equal timestamps)
    }

    private async mergeTable<T extends TimestampedSyncRecord>(
        table: Table<T, number>,
        remoteRecords: T[],
        entityType: ConflictLog['entityType'],
    ): Promise<void> {
        for (const remote of remoteRecords) {
            const local = await table.where('uuid').equals(remote.uuid).first();

            if (!local) {
                const { id: _remoteId, ...rest } = remote as T & { id?: number };
                void _remoteId;
                await table.add(rest as T);
                continue;
            }

            if (remote.updatedAt > local.updatedAt) {
                if (
                    hasMeaningfulDivergence(
                        local as unknown as Record<string, unknown>,
                        remote as unknown as Record<string, unknown>,
                    )
                ) {
                    await this.logConflict(
                        entityType,
                        remote.uuid,
                        local.updatedAt,
                        remote.updatedAt,
                        { local, remote } as unknown as Record<string, unknown>,
                        'remote',
                    );
                }
                await table.put({
                    ...remote,
                    id: local.id,
                });
            }
        }
    }

    private async mergeConflictLog(remoteRecords: ConflictLog[]): Promise<void> {
        for (const remote of remoteRecords) {
            const local = await db.conflictLog.where('uuid').equals(remote.uuid).first();

            if (!local) {
                const { id: _remoteId, ...rest } = remote;
                void _remoteId;
                await db.conflictLog.add(rest as ConflictLog);
                continue;
            }

            await db.conflictLog.put({
                ...remote,
                id: local.id,
            });
        }
    }

    async sync(): Promise<void> {
        if (!(await this.provider.isAuthenticated())) {
            await this.provider.connect();
        }

        const remoteSnapshot = await this.provider.pull();
        if (remoteSnapshot) {
            await this.mergeSnapshot(remoteSnapshot);
        }

        const localSnapshot = await this.createSnapshot();
        await this.provider.push(localSnapshot);
    }
}
