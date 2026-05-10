import type { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { ConflictLog, Settings } from '../../types';
import type { SyncSnapshot, SyncProvider } from './types';

const SCHEMA_VERSION = 3;

type TimestampedSyncRecord = {
    id?: number;
    uuid: string;
    updatedAt: number;
};

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

    async mergeSnapshot(remote: SyncSnapshot): Promise<void> {
        if (remote.schemaVersion !== SCHEMA_VERSION) {
            throw new Error(`Schema version mismatch. Local: ${SCHEMA_VERSION}, Remote: ${remote.schemaVersion}`);
        }

        await db.transaction('rw', [db.settings, db.exercises, db.workouts, db.workoutExercises, db.sets, db.workoutTemplates, db.conflictLog], async () => {
            await this.mergeSettings(remote.data.settings || []);
            await this.mergeTable(db.exercises, remote.data.exercises);
            await this.mergeTable(db.workouts, remote.data.workouts);
            await this.mergeTable(db.workoutExercises, remote.data.workoutExercises);
            await this.mergeTable(db.sets, remote.data.sets);
            await this.mergeTable(db.workoutTemplates, remote.data.workoutTemplates || []);
            await this.mergeConflictLog(remote.data.conflictLog || []);
        });
    }

    private async mergeSettings(remoteSettings: Settings[]): Promise<void> {
        const remote = remoteSettings[0];
        if (!remote) {
            return;
        }

        const local = await db.settings.toCollection().first();
        await db.settings.put({
            ...remote,
            id: local?.id ?? remote.id ?? 1,
        });
    }

    private async mergeTable<T extends TimestampedSyncRecord>(table: Table<T, number>, remoteRecords: T[]): Promise<void> {
        for (const remote of remoteRecords) {
            const local = await table.where('uuid').equals(remote.uuid).first();

            if (!local) {
                await table.add(remote);
                continue;
            }

            if (remote.updatedAt > local.updatedAt) {
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
                await db.conflictLog.add(remote);
                continue;
            }

            await db.conflictLog.put({
                ...remote,
                id: local.id,
            });
        }
    }

    async sync(): Promise<void> {
        if (!await this.provider.isAuthenticated()) {
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
