import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
    Exercise,
    Workout,
    WorkoutExercise,
    SetEntry,
    Settings,
    ConflictLog,
    WorkoutTemplate
} from '../types';
import {
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
    workoutTemplates!: Table<WorkoutTemplate>;

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
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, updatedAt, deletedAt'
        });

        this.version(2).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, isCustom, updatedAt, deletedAt'
        }).upgrade(async (tx) => {
            await tx.table('workoutTemplates').toCollection().modify((t: any) => {
                if (typeof t.isCustom !== 'boolean') {
                    t.isCustom = false;
                }
            });
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
            { name: 'Dumbbell Row', muscleGroup: 'back', movementType: 'compound', isUnilateral: true },
            { name: 'Lunges', muscleGroup: 'legs', movementType: 'compound', isUnilateral: true },
            { name: 'Leg Press', muscleGroup: 'legs', movementType: 'compound' },
            { name: 'Lat Pulldown', muscleGroup: 'back', movementType: 'isolation' },
            { name: 'Bicep Curl (Dumbbell)', muscleGroup: 'arms', movementType: 'isolation', isUnilateral: true },
            { name: 'Tricep Extension', muscleGroup: 'arms', movementType: 'isolation' },
            { name: 'Plank', muscleGroup: 'core', movementType: 'isometric' },
            { name: 'Sit-Up', muscleGroup: 'core', movementType: 'compound' },
            { name: 'Bulgarian Split Squat', muscleGroup: 'legs', movementType: 'compound', isUnilateral: true },
            { name: 'Dips', muscleGroup: 'chest', movementType: 'compound' },
            { name: 'Calf Raise', muscleGroup: 'legs', movementType: 'isolation' },
        ];

        const now = Date.now();
        const exercisesWithUUIDs = defaultExercises.map(ex => ({
            ...ex,
            uuid: uuidv4(),
            isCustom: false,
            updatedAt: now,
            equipment: 'gym',
            aliases: []
        } as Exercise));
        
        await this.exercises.bulkAdd(exercisesWithUUIDs);

        // Default Workout Templates
        const pullUpUUID = exercisesWithUUIDs.find(e => e.name === 'Pull Up')?.uuid;
        const squatUUID = exercisesWithUUIDs.find(e => e.name === 'Squat (Barbell)')?.uuid;
        const benchPressUUID = exercisesWithUUIDs.find(e => e.name === 'Bench Press (Barbell)')?.uuid;
        const deadliftUUID = exercisesWithUUIDs.find(e => e.name === 'Deadlift (Barbell)')?.uuid;
        const dipsUUID = exercisesWithUUIDs.find(e => e.name === 'Dips')?.uuid;
        const bulgarianUUID = exercisesWithUUIDs.find(e => e.name === 'Bulgarian Split Squat')?.uuid;

        const defaultTemplates: Partial<WorkoutTemplate>[] = [
            {
                name: 'Upper Body',
                description: 'Chest, back, and arms',
                exercises: [benchPressUUID, pullUpUUID, dipsUUID].filter(Boolean) as string[]
            },
            {
                name: 'Lower Body',
                description: 'Legs and glutes',
                exercises: [squatUUID, bulgarianUUID, deadliftUUID].filter(Boolean) as string[]
            },
            {
                name: 'Full Body',
                description: 'Complete workout',
                exercises: [squatUUID, benchPressUUID, pullUpUUID, deadliftUUID].filter(Boolean) as string[]
            }
        ];

        await this.workoutTemplates.bulkAdd(
            defaultTemplates.map(template => ({
                ...template,
                uuid: uuidv4(),
                isCustom: false,
                updatedAt: now
            } as WorkoutTemplate))
        );
    }
}

export const db = new AppDatabase();
