import React, { useState } from 'react';
import type { Workout, WorkoutExercise } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { Plus, CheckCircle, MoreVertical, Trash2 } from 'lucide-react';
import { ExercisePickerModal } from './ExercisePickerModal';
import { v4 as uuidv4 } from 'uuid';
import { SetList } from './SetList'; // We'll implement this next

export const ActiveWorkoutView: React.FC<{ workout: Workout }> = ({ workout }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Load workout exercises (sorted by order ideally, but simple list for now)
    const exercises = useLiveQuery(async () => {
        const list = await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
        // sort by order
        return list.sort((a, b) => a.order - b.order);
    }, [workout.uuid]);

    // Load implementation details (exercise names) - optimized join
    // Alternatively, SetList can fetch its own exercise details or we do a comprehensive query.
    // For simplicity, let's just pass workoutExercise to SetList and let it resolve name.
    // Or we create a mapped object here.

    const handleAddExercise = async (exerciseId: string) => {
        try {
            const count = await db.workoutExercises.where('workoutId').equals(workout.uuid).count();
            await db.workoutExercises.add({
                uuid: uuidv4(),
                workoutId: workout.uuid,
                exerciseId,
                order: count,
                updatedAt: Date.now()
            });
            setIsPickerOpen(false);
        } catch (e) {
            console.error("Failed to add exercise", e);
        }
    };

    const handleFinish = async () => {
        if (confirm('Finish workout?')) {
            await db.workouts.update(workout.id!, {
                endedAt: Date.now(),
                updatedAt: Date.now()
            });
            // Navigation handled by WorkoutPage (activeWorkout becomes null)
        }
    };

    const cancelWorkout = async () => {
        if (confirm('Delete this workout logic? This cannot be undone.')) {
            // Ideally cascade delete (sets, workoutExercises).
            // For MVP, simplistic delete.
            await db.workouts.delete(workout.id!);
            // We should clean up orphans, but okay for MVP.
        }
    }

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Header */}
            <div className="p-4 bg-bg-secondary border-b border-border flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div>
                    <h1 className="text-lg font-bold">Current Workout</h1>
                    <p className="text-xs text-text-secondary">Started at {new Date(workout.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <Button size="sm" variant="primary" onClick={handleFinish} className="gap-2">
                    <CheckCircle size={16} /> Finish
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                {exercises?.length === 0 && (
                    <div className="text-center py-10 text-text-secondary">
                        <p>No exercises yet.</p>
                        <p className="text-sm">Add one to get started!</p>
                    </div>
                )}

                {exercises?.map((we) => (
                    <WorkoutExerciseItem key={we.uuid} workoutExercise={we} />
                ))}

                <Button
                    variant="secondary"
                    fullWidth
                    className="py-4 border-2 border-dashed border-border bg-transparent hover:bg-bg-tertiary"
                    onClick={() => setIsPickerOpen(true)}
                >
                    <Plus size={20} className="mr-2" /> Add Exercise
                </Button>

                <div className="pt-8 flex justify-center">
                    <Button variant="ghost" size="sm" onClick={cancelWorkout} className="text-danger">
                        <Trash2 size={14} className="mr-1" /> Discard Workout
                    </Button>
                </div>
            </div>

            <ExercisePickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={handleAddExercise}
            />
        </div>
    );
};

// Sub-component wrapper to fetch exercise name cleanly
const WorkoutExerciseItem: React.FC<{ workoutExercise: WorkoutExercise }> = ({ workoutExercise }) => {
    const exercise = useLiveQuery(() => db.exercises.where('uuid').equals(workoutExercise.exerciseId).first());

    if (!exercise) return <div className="animate-pulse bg-bg-tertiary h-20 rounded-lg"></div>;

    return (
        <SetList workoutExercise={workoutExercise} exerciseName={exercise.name} />
    );
}
