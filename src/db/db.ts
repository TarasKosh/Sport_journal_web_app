import Dexie, { Table } from 'dexie';
import {
    Exercise,
    Workout,
    WorkoutExercise,
    SetEntry,
    Settings,
    ConflictLog,
    MassUnit,
    RPEType
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AppDatabase extends Dexie {
    settings!: Table<Settings>;
    exercises!: Table<Exercise>;
    workouts!: Table<Workout>;
    workoutExercises!: Table<WorkoutExercise>;
    sets!: Table<SetEntry>;
    conflictLog!: Table<ConflictLog>;

    constructor() {
        super('StrengthJournalDB');

        // Schema definition
        // Note: We use 'uuid' for relationships to facilitate sync, 
        // but keep auto-increment 'id' for local indexing speed if needed, 
        // though Dexie works fine with uuid as primary too. 
        // Prompt asked for "indices Dexie by updatedAt, workout startedAt, exerciseId"
        this.version(1).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId'
        });

        this.on('populate', () => {
            this.seedData();
        });
    }

    async seedData() {
        // Initial Settings
        await this.settings.add({
            massUnit: MassUnit.KG,
            weightStep: 2.5,
            defaultRPEType: RPEType.RPE,
            theme: 'system',
            language: 'en' // or ru
        });

        // Default Exercises
        const defaultExercises: Partial<Exercise>[] = [
            { name: 'Squat (Barbell)', muscleGroup: 'legs', movementType: 'compound' },
            { name: 'Bench Press (Barbell)', muscleGroup: 'chest', movementType: 'compound' },
            { name: 'Deadlift (Barbell)', muscleGroup: 'back', movementType: 'compound' },
            { name: 'Overhead Press (Barbell)', muscleGroup: 'shoulders', movementType: 'compound' },
            { name: 'Pull Up', muscleGroup: 'back', movementType: 'compound' },
            { name: 'Dumbbell Row', muscleGroup: 'back', movementType: 'compound' },
            { name: 'Lunges', muscleGroup: 'legs', movementType: 'compound' },
            { name: 'Leg Press', muscleGroup: 'legs', movementType: 'compound' },
            { name: 'Lat Pulldown', muscleGroup: 'back', movementType: 'isolation' },
            { name: 'Bicep Curl (Dumbbell)', muscleGroup: 'arms', movementType: 'isolation' },
            { name: 'Tricep Extension', muscleGroup: 'arms', movementType: 'isolation' },
            { name: 'Plank', muscleGroup: 'core', movementType: 'isometric' },
        ];

        const now = Date.now();
        await this.exercises.bulkAdd(
            defaultExercises.map(ex => ({
                ...ex,
                uuid: uuidv4(),
                isCustom: false,
                updatedAt: now,
                equipment: 'gym',
                aliases: []
            } as Exercise))
        );
    }
}

export const db = new AppDatabase();
