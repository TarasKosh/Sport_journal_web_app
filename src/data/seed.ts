import { v4 as uuidv4 } from 'uuid';
import type { AppDatabase } from '../db/db';
import type { Exercise, Settings, WorkoutTemplate } from '../types';
import { MassUnit, RPEType } from '../types';
import { nowMonotonic } from './clock';

/**
 * Built-in catalog.
 *
 * Bumping `CATALOG_VERSION` makes `ensureCatalog` upsert the new defaults for *existing*
 * users as well: the old `populate`-only seeding never reached them.
 */
export const CATALOG_VERSION = 1;

export const DEFAULT_EXERCISES: Array<Pick<Exercise, 'name' | 'muscleGroup' | 'movementType' | 'isUnilateral'>> = [
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

const DEFAULT_TEMPLATES: Array<Pick<WorkoutTemplate, 'name' | 'description'> & { exerciseNames: string[] }> = [
    {
        name: 'Upper Body',
        description: 'Chest, back, and arms',
        exerciseNames: ['Bench Press (Barbell)', 'Pull Up', 'Dips'],
    },
    {
        name: 'Lower Body',
        description: 'Legs and glutes',
        exerciseNames: ['Squat (Barbell)', 'Bulgarian Split Squat', 'Deadlift (Barbell)'],
    },
    {
        name: 'Full Body',
        description: 'Complete workout',
        exerciseNames: ['Squat (Barbell)', 'Bench Press (Barbell)', 'Pull Up', 'Deadlift (Barbell)'],
    },
];

export function defaultSettings(now = nowMonotonic()): Settings {
    return {
        massUnit: MassUnit.KG,
        weightStep: 2.5,
        defaultRPEType: RPEType.RPE,
        theme: 'system',
        language: 'en',
        catalogVersion: CATALOG_VERSION,
        updatedAt: now,
    };
}

/**
 * Inserts the built-in catalog. Idempotent: existing rows (matched by name) are left
 * untouched so user edits and custom exercises are never clobbered.
 */
export async function seedDefaults(database: AppDatabase): Promise<void> {
    const now = nowMonotonic();

    await database.settings.add(defaultSettings(now));

    const exercises: Exercise[] = DEFAULT_EXERCISES.map(entry => ({
        ...entry,
        uuid: uuidv4(),
        isCustom: false,
        updatedAt: now,
        equipment: 'gym',
        aliases: [],
        variations: [],
    }));
    await database.exercises.bulkAdd(exercises);

    const uuidByName = new Map(exercises.map(exercise => [exercise.name, exercise.uuid]));
    const templates: WorkoutTemplate[] = DEFAULT_TEMPLATES.map(template => ({
        name: template.name,
        description: template.description,
        exercises: template.exerciseNames
            .map(name => uuidByName.get(name))
            .filter((uuid): uuid is string => typeof uuid === 'string'),
        uuid: uuidv4(),
        isCustom: false,
        updatedAt: now,
    }));
    await database.workoutTemplates.bulkAdd(templates);
}

/**
 * Upserts the built-in catalog for existing installs. Safe to call on every start:
 * when the catalog version is already current it performs a single read.
 */
export async function ensureCatalog(database: AppDatabase): Promise<void> {
    const settings = await database.settings.toCollection().first();
    if (settings == null) {
        await seedDefaults(database);
        return;
    }
    if ((settings.catalogVersion ?? 0) >= CATALOG_VERSION) {
        return;
    }

    const now = nowMonotonic();
    await database.transaction('rw', [database.settings, database.exercises, database.workoutTemplates], async () => {
        const existingExercises = await database.exercises.toArray();
        const knownNames = new Set(existingExercises.map(exercise => exercise.name));

        const missing: Exercise[] = DEFAULT_EXERCISES
            .filter(entry => !knownNames.has(entry.name))
            .map(entry => ({
                ...entry,
                uuid: uuidv4(),
                isCustom: false,
                updatedAt: now,
                equipment: 'gym',
                aliases: [],
                variations: [],
            }));
        if (missing.length > 0) {
            await database.exercises.bulkAdd(missing);
        }

        const uuidByName = new Map<string, string>();
        for (const exercise of [...existingExercises, ...missing]) {
            uuidByName.set(exercise.name, exercise.uuid);
        }

        const existingTemplates = await database.workoutTemplates.toArray();
        const knownTemplateNames = new Set(existingTemplates.map(template => template.name));
        const missingTemplates: WorkoutTemplate[] = DEFAULT_TEMPLATES
            .filter(template => !knownTemplateNames.has(template.name))
            .map(template => ({
                name: template.name,
                description: template.description,
                exercises: template.exerciseNames
                    .map(name => uuidByName.get(name))
                    .filter((uuid): uuid is string => typeof uuid === 'string'),
                uuid: uuidv4(),
                isCustom: false,
                updatedAt: now,
            }));
        if (missingTemplates.length > 0) {
            await database.workoutTemplates.bulkAdd(missingTemplates);
        }

        await database.settings.update(settings.id!, { catalogVersion: CATALOG_VERSION, updatedAt: now });
    });
}
