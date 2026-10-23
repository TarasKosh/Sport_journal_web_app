import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, WorkoutExercise } from '../types';
import { WorkoutExerciseRepository } from '../data/repositories/WorkoutExerciseRepository';
import { TemplateRepository } from '../data/repositories/TemplateRepository';
import { useExerciseIndex } from './useExerciseIndex';

export type WorkoutEditor = {
    /** Active exercises of the workout, ordered. */
    workoutExercises: WorkoutExercise[] | undefined;
    exerciseIndex: ReadonlyMap<string, Exercise>;
    addExercise: (exerciseUuid: string) => Promise<void>;
    addTemplate: (templateUuid: string) => Promise<void>;
    moveExercise: (workoutExerciseUuid: string, direction: 'up' | 'down') => Promise<void>;
    removeExercise: (workoutExerciseUuid: string) => Promise<void>;
};

/**
 * Exercise composition of a workout.
 *
 * ActiveWorkoutView and EditWorkoutModal used to carry two near-identical copies of this
 * logic (~150 lines each), which drifted. Both now consume this hook.
 */
export function useWorkoutEditor(workoutUuid: string): WorkoutEditor {
    const workoutExercises = useLiveQuery(
        () => WorkoutExerciseRepository.listByWorkout(workoutUuid),
        [workoutUuid],
    );
    const exerciseIndex = useExerciseIndex();

    const addExercise = useCallback(async (exerciseUuid: string) => {
        await WorkoutExerciseRepository.add(workoutUuid, exerciseUuid);
    }, [workoutUuid]);

    const addTemplate = useCallback(async (templateUuid: string) => {
        await TemplateRepository.addToWorkout(templateUuid, workoutUuid);
    }, [workoutUuid]);

    const moveExercise = useCallback(async (workoutExerciseUuid: string, direction: 'up' | 'down') => {
        await WorkoutExerciseRepository.move(workoutExerciseUuid, direction);
    }, []);

    const removeExercise = useCallback(async (workoutExerciseUuid: string) => {
        await WorkoutExerciseRepository.remove(workoutExerciseUuid);
    }, []);

    return { workoutExercises, exerciseIndex, addExercise, addTemplate, moveExercise, removeExercise };
}
