import React, { useState } from 'react';
import type { Exercise, MuscleGroup } from '../../types';
import { db } from '../../db/db';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface EditExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise?: Exercise;
}

export const EditExerciseModal: React.FC<EditExerciseModalProps> = ({ isOpen, onClose, exercise }) => {
    const [name, setName] = useState(exercise?.name || '');
    const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscleGroup || 'other');
    // const [movement, setMovement] = useState<MovementType>('compound'); // Simplified for MVP

    // Reset state when exercise prop changes (state-during-render pattern)
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
                // Update
                await db.exercises.update(exercise.id, {
                    name,
                    muscleGroup: muscle,
                    updatedAt: Date.now()
                });
            } else {
                // Create
                await db.exercises.add({
                    uuid: uuidv4(),
                    name,
                    muscleGroup: muscle,
                    isCustom: true,
                    updatedAt: Date.now(),
                    aliases: []
                } as Exercise);
            }
            onClose();
        } catch (e) {
            console.error("Failed to save exercise", e);
            alert("Error saving exercise");
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
            style={{ zIndex: 70 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-exercise-title"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-bg-secondary w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-slide-up sm:animate-zoom-in">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 id="edit-exercise-title" className="text-lg font-bold">{exercise ? 'Edit Exercise' : 'New Exercise'}</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary" aria-label="Close"><X size={24} /></button>
                </div>

                <div className="p-4 space-y-4">
                    <Input
                        label="Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Bench Press"
                        autoFocus
                    />

                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-text-secondary font-medium">Muscle Group</label>
                        <select
                            className="w-full bg-bg-tertiary border border-transparent rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                            value={muscle}
                            onChange={e => setMuscle(e.target.value as MuscleGroup)}
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

                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>{exercise ? 'Save Changes' : 'Create Exercise'}</Button>
                </div>
            </div>
        </div>
    );
};
