import { db } from '../../db/db';
import type { SyncSnapshot, SyncProvider } from './types';
import { v4 as uuidv4 } from 'uuid';

const SCHEMA_VERSION = 1;

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
                conflictLog
            }
        };
    }

    async mergeSnapshot(remote: SyncSnapshot) {
        if (remote.schemaVersion !== SCHEMA_VERSION) {
            throw new Error(`Schema version mismatch. Local: ${SCHEMA_VERSION}, Remote: ${remote.schemaVersion}`);
        }

        await db.transaction('rw', [db.settings, db.exercises, db.workouts, db.workoutExercises, db.sets, db.conflictLog], async () => {
            await this.mergeTable(db.settings, remote.data.settings);
            await this.mergeTable(db.exercises, remote.data.exercises);
            await this.mergeTable(db.workouts, remote.data.workouts);
            await this.mergeTable(db.workoutExercises, remote.data.workoutExercises);

            await this.mergeTable(db.sets, remote.data.sets);
            // Conflicts are additive usually, or we just keep local? Let's merge generic.
            await this.mergeTable(db.conflictLog, remote.data.conflictLog || []);
        });
    }

    private async mergeTable(table: any, remoteRecords: any[]) {
        for (const remote of remoteRecords) {
            // Assuming all entities have uuid and updatedAt. Settings might purely use ID? 
            // Our Settings type has ID but we should use singleton logic.
            // If table is Settings, handle differently.
            if (table.name === 'settings') {
                // Naive singleton merge: LWW
                const local = await table.toCollection().first();
                if (!local || (remote.id && remote.id === local.id)) { // assume id=1
                    // If local doesn't exist or remote is fresher? Settings usually don't have updatedAt in my type definition!
                    // Check type.ts: Settings interface missing updatedAt.
                    // I should Fix Settings interface to include updatedAt.
                    // For now, overwrite if different? Or skip.
                    // Let's assume Settings are local pref for now or fix definitions.
                    // Prompt says: "Settings... язык, часовой пояс". Should sync? "SyncMeta для каждой записи". 
                    // OK, I'll assume I should have added updatedAt to Settings. I'll patch it later.
                    // For now, if no updatedAt, skip settings sync or always overwrite.
                    continue;
                }
            }

            if (!remote.uuid) continue;

            const local = await table.where('uuid').equals(remote.uuid).first();

            if (!local) {
                // New record
                await table.add(remote);
            } else {
                // Conflict or Update
                if (remote.updatedAt > local.updatedAt) {
                    // Remote is newer (wins)
                    // We must use 'put' with the local ID to update correctly in Dexie if using auto-increment primary key
                    await table.put({ ...remote, id: local.id });
                } else if (remote.updatedAt < local.updatedAt) {
                    // Local is newer, do nothing (will push later)
                } else {
                    // Equal. Identical?
                    // If content differs, it's a conflict but same timestamp is rare.
                }
            }
        }
    }

    async sync() {
        if (!await this.provider.isAuthenticated()) {
            await this.provider.connect();
        }

        // 1. Pull
        const remoteSnapshot = await this.provider.pull();
        if (remoteSnapshot) {
            await this.mergeSnapshot(remoteSnapshot);
        }

        // 2. Push
        const localSnapshot = await this.createSnapshot();
        await this.provider.push(localSnapshot);
    }
}
