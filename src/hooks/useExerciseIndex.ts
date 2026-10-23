import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise } from '../types';
import { ExerciseRepository } from '../data/repositories/ExerciseRepository';

const EMPTY: ReadonlyMap<string, Exercise> = new Map();

/**
 * Shared uuid → exercise lookup.
 *
 * Includes soft-deleted exercises so history still resolves names, and replaces the four
 * separate `db.exercises.toArray()` live queries that each rebuilt this map locally.
 */
export function useExerciseIndex(): ReadonlyMap<string, Exercise> {
    const exercises = useLiveQuery(() => ExerciseRepository.listAll(), []);
    return useMemo(() => {
        if (!exercises) return EMPTY;
        return new Map(exercises.map(exercise => [exercise.uuid, exercise]));
    }, [exercises]);
}
