import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { Exercise, MuscleGroup, MovementType } from '../../types';
import { onlyActive } from '../../utils/entityFilters';
import { normalizeExercise } from '../normalize';
import { nowMonotonic } from '../clock';
import { softDeleteExercise } from '../../services/data/softDelete';

export type ExerciseDraft = {
    name: string;
    muscleGroup: MuscleGroup;
    movementType?: MovementType;
    equipment?: string;
    isUnilateral?: boolean;
    notes?: string;
};

/**
 * Exercise library access.
 *
 * `indexByUuid` intentionally includes soft-deleted rows: history and active workouts must
 * still resolve the name of an exercise that was removed from the library afterwards.
 */
export const ExerciseRepository = {
    /** Active exercises, alphabetical. */
    async listActive(): Promise<Exercise[]> {
        return onlyActive(await db.exercises.orderBy('name').toArray());
    },

    /** Every exercise, including soft-deleted ones (name resolution for old records). */
    async listAll(): Promise<Exercise[]> {
        return db.exercises.toArray();
    },

    async indexByUuid(): Promise<Map<string, Exercise>> {
        const all = await db.exercises.toArray();
        return new Map(all.map(exercise => [exercise.uuid, exercise]));
    },

    async getByUuid(uuid: string): Promise<Exercise | undefined> {
        return db.exercises.where('uuid').equals(uuid).first();
    },

    async search(query: string): Promise<Exercise[]> {
        const all = await this.listActive();
        const needle = query.trim().toLowerCase();
        if (!needle) return all;
        return all.filter(exercise =>
            exercise.name.toLowerCase().includes(needle) ||
            exercise.muscleGroup.toLowerCase().includes(needle) ||
            (exercise.aliases ?? []).some(alias => alias.toLowerCase().includes(needle)),
        );
    },

    async create(draft: ExerciseDraft): Promise<Exercise> {
        const now = nowMonotonic();
        const exercise: Exercise = {
            uuid: uuidv4(),
            name: draft.name.trim(),
            muscleGroup: draft.muscleGroup,
            movementType: draft.movementType,
            equipment: draft.equipment,
            isUnilateral: draft.isUnilateral,
            notes: draft.notes,
            isCustom: true,
            aliases: [],
            variations: [],
            updatedAt: now,
        };
        await db.exercises.add(exercise);
        return exercise;
    },

    async update(id: number, patch: Partial<Exercise>): Promise<void> {
        const existing = await db.exercises.get(id);
        if (!existing) return;
        const merged = normalizeExercise({ ...existing, ...patch, updatedAt: nowMonotonic() });
        await db.exercises.put(merged);
    },

    /** Adds a variation name (case-insensitive de-duplication) and returns the updated row. */
    async addVariation(id: number, variation: string): Promise<Exercise | undefined> {
        const existing = await db.exercises.get(id);
        if (!existing) return undefined;
        const name = variation.trim();
        if (!name) return existing;

        const current = existing.variations ?? [];
        if (current.some(value => value.toLowerCase() === name.toLowerCase())) return existing;

        const updated = normalizeExercise({
            ...existing,
            variations: [...current, name],
            updatedAt: nowMonotonic(),
        });
        await db.exercises.put(updated);
        return updated;
    },

    async softDelete(id: number): Promise<void> {
        await softDeleteExercise(id);
    },
};
