import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/db';
import type { WorkoutTemplate } from '../../types';
import { onlyActive } from '../../utils/entityFilters';
import { normalizeTemplate } from '../normalize';
import { nowMonotonic } from '../clock';
import { softDeleteWorkoutTemplate } from '../../services/data/softDelete';
import { WorkoutExerciseRepository } from './WorkoutExerciseRepository';

export type TemplateDraft = {
    name: string;
    description?: string;
    exercises: string[];
};

export const TemplateRepository = {
    async listActive(): Promise<WorkoutTemplate[]> {
        return onlyActive(await db.workoutTemplates.orderBy('name').toArray());
    },

    async getByUuid(uuid: string): Promise<WorkoutTemplate | undefined> {
        return db.workoutTemplates.where('uuid').equals(uuid).first();
    },

    async create(draft: TemplateDraft): Promise<WorkoutTemplate> {
        const now = nowMonotonic();
        const template: WorkoutTemplate = {
            uuid: uuidv4(),
            name: draft.name.trim(),
            description: draft.description,
            exercises: draft.exercises,
            isCustom: true,
            updatedAt: now,
        };
        await db.workoutTemplates.add(template);
        return template;
    },

    async update(id: number, patch: Partial<WorkoutTemplate>): Promise<void> {
        const existing = await db.workoutTemplates.get(id);
        if (!existing) return;
        const merged = normalizeTemplate({ ...existing, ...patch, updatedAt: nowMonotonic() });
        await db.workoutTemplates.put(merged);
    },

    async softDelete(id: number): Promise<void> {
        await softDeleteWorkoutTemplate(id);
    },

    /** Appends every exercise of a template to a workout in one transaction. */
    async addToWorkout(templateUuid: string, workoutUuid: string): Promise<number> {
        const template = await this.getByUuid(templateUuid);
        if (!template || template.deletedAt != null) return 0;
        await WorkoutExerciseRepository.addMany(workoutUuid, template.exercises);
        return template.exercises.length;
    },
};
