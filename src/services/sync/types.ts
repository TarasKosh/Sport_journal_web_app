import type { Exercise, Workout, WorkoutExercise, SetEntry, Settings, ConflictLog } from '../../types';

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
