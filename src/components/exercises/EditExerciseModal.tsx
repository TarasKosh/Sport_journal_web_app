import React, { useState } from 'react';
import type { Exercise, MuscleGroup } from '../../types';
import { db } from '../../db/db';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ModalShell } from '../common/ModalShell';
import { v4 as uuidv4 } from 'uuid';

interface EditExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise?: Exercise;
}

export const EditExerciseModal: React.FC<EditExerciseModalProps> = ({ isOpen, onClose, exercise }) => {
    const [name, setName] = useState(exercise?.name || '');
    const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscleGroup || 'other');

    const [prevExercise, setPrevExercise] = useState(exercise);
    if (exercise !== prevExercise) {
        setPrevExercise(exercise);
        setName(exercise?.name || '');
        setMuscle(exercise?.muscleGroup || 'other');
    }

    const handleSave = async () => {
        if (!name.trim()) return;

        try {
            if (exercise && exercise.id) {
                await db.exercises.update(exercise.id, {
                    name,
                    muscleGroup: muscle,
                    updatedAt: Date.now()
                });
            } else {
                await db.exercises.add({
                    uuid: uuidv4(),
                    name,
                    muscleGroup: muscle,
                    isCustom: true,
                    updatedAt: Date.now()
                } as Exercise);
            }
            onClose();
        } catch (e) {
            console.error("Failed to save exercise", e);
            alert("Error saving exercise");
        }
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title={exercise ? 'Edit Exercise' : 'New Exercise'}
            titleId="edit-exercise-title"
            gradientHeader={false}
            maxWidth="sm"
            height="auto"
            footer={(
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>{exercise ? 'Save Changes' : 'Create Exercise'}</Button>
                </div>
            )}
        >
            <div className="p-4 space-y-4">
                <Input
                    label="Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Bench Press"
                />

                <div className="flex flex-col gap-1">
                    <label className="text-sm text-text-secondary font-medium" id="edit-exercise-muscle-label">Muscle Group</label>
                    <select
                        className="w-full bg-bg-tertiary border border-transparent rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                        value={muscle}
                        onChange={e => setMuscle(e.target.value as MuscleGroup)}
                        aria-labelledby="edit-exercise-muscle-label"
                    >
                        <option value="chest">Chest</option>
                        <option value="back">Back</option>
                        <option value="legs">Legs</option>
                        <option value="shoulders">Shoulders</option>
                        <option value="arms">Arms</option>
                        <option value="core">Core</option>
                        <option value="full_body">Full Body</option>
                        <option value="cardio">Cardio</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
        </ModalShell>
    );
};
