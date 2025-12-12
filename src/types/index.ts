export type UUID = string;

export enum MassUnit {
    KG = 'kg',
    LB = 'lb',
}

export enum RPEType {
    RPE = 'rpe', // Rate of Perceived Exertion (1-10)
    RIR = 'rir', // Reps In Reserve
}

export type MuscleGroup =
    | 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'full_body' | 'cardio' | 'other';

export type MovementType = 'compound' | 'isolation' | 'isometric' | 'cardio';

export interface Settings {
    id?: number; // Singleton, usually 1
    massUnit: MassUnit;
    weightStep: number; // e.g., 2.5
    defaultRPEType: RPEType;
    theme: 'dark' | 'light' | 'system';
    language: string;
}

export interface Exercise {
    id?: number; // Dexie auto-increment
    uuid: UUID;
    name: string;
    muscleGroup: MuscleGroup;
    movementType?: MovementType;
    equipment?: string;
    aliases?: string[];
    isCustom: boolean;
    notes?: string;

    // Sync Meta
    updatedAt: number;
    deletedAt?: number;
}

export interface Workout {
    id?: number;
    uuid: UUID;
    startedAt: number;
    endedAt?: number;
    title?: string; // Optional custom title
    tags?: string[];
    mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
    notes?: string;
    bodyWeight?: number;

    // Sync Meta
    updatedAt: number;
    deletedAt?: number;
}

export interface WorkoutExercise {
    id?: number;
    uuid: UUID;
    workoutId: UUID; // Foreign Key to Workout UUID (not ID, for sync safety)
    exerciseId: UUID;
    order: number;
    notes?: string;

    // Sync Meta
    updatedAt: number;
    deletedAt?: number;
}

export interface SetEntry {
    id?: number;
    uuid: UUID;
    workoutExerciseId: UUID;
    order: number;
    weight: number;
    reps: number;
    rpe?: number;
    rir?: number;
    restSec?: number;
    isWarmup: boolean;
    isFailure: boolean;
    notes?: string;

    // Sync Meta
    updatedAt: number;
    deletedAt?: number;
}

export interface ConflictLog {
    id?: number;
    uuid: UUID;
    entityType: 'workout' | 'exercise' | 'set' | 'workout_exercise' | 'settings';
    entityId: UUID;
    localUpdatedAt: number;
    remoteUpdatedAt: number;
    resolvedAt?: number;
    resolution?: 'local' | 'remote' | 'manual';
    snapshot?: any; // JSON snapshot of the conflict
}
