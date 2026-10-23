import type { Exercise, Workout, WorkoutExercise, SetEntry, Settings, ConflictLog, WorkoutTemplate } from '../../types';

export interface SyncSnapshot {
    schemaVersion: number;
    exportedAt: number;
    deviceId: string;
    data: {
        settings: Settings[]; // Provide array for consistency, though singleton
        exercises: Exercise[];
        workouts: Workout[];
        workoutExercises: WorkoutExercise[];
        sets: SetEntry[];
        workoutTemplates?: WorkoutTemplate[];
        conflictLog?: ConflictLog[];
    };
}

export interface SyncStatus {
    lastSync?: number;
    inProgress: boolean;
    error?: string;
}

export interface SyncProvider {
    name: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isAuthenticated(): Promise<boolean>;
    pull(): Promise<SyncSnapshot | null>;
    push(snapshot: SyncSnapshot): Promise<void>;
}

/**
 * The remote snapshot changed between this provider's pull() and push() (another device
 * uploaded a newer snapshot in the meantime). The local merge from that sync run is already
 * committed, so nothing is lost — the caller should surface the message and the user should
 * re-run the sync to merge the newer remote data before pushing again.
 */
export class RemoteSnapshotChangedError extends Error {
    constructor() {
        super('The Drive snapshot changed while this device was syncing — run sync again to pick up the latest data.');
        this.name = 'RemoteSnapshotChangedError';
    }
}
