import React, { useState } from 'react';
import type { Workout, WorkoutExercise } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { Plus, CheckCircle, Trash2, Clock, Dumbbell } from 'lucide-react';

import { ExercisePickerModal } from './ExercisePickerModal';
import { v4 as uuidv4 } from 'uuid';
import { SetList } from './WorkoutSetList';

export const ActiveWorkoutView: React.FC<{ workout: Workout }> = ({ workout }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [workoutDuration, setWorkoutDuration] = useState('00:00');

    // Update workout duration every second
    React.useEffect(() => {
        const interval = setInterval(() => {
            const duration = Date.now() - workout.startedAt;
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            setWorkoutDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [workout.startedAt]);

    const exercises = useLiveQuery(async () => {
        const list = await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
        return list.sort((a, b) => a.order - b.order);
    }, [workout.uuid]);

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
        }
    };

    const cancelWorkout = async () => {
        if (confirm('Delete this workout? This cannot be undone.')) {
            await db.workouts.delete(workout.id!);
        }
    };

    const deleteExercise = async (workoutExerciseId: number) => {
        if (confirm('Remove this exercise from workout?')) {
            const we = exercises?.find(e => e.id === workoutExerciseId);
            if (!we) return;
            
            // Delete all sets for this exercise
            const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
            await db.sets.bulkDelete(sets.map(s => s.id!));
            // Delete the workout exercise
            await db.workoutExercises.delete(workoutExerciseId);
            // Reorder remaining exercises
            if (exercises) {
                const remaining = exercises.filter(e => e.id !== workoutExerciseId);
                for (let i = 0; i < remaining.length; i++) {
                    await db.workoutExercises.update(remaining[i].id!, { order: i, updatedAt: Date.now() });
                }
            }
        }
    };

    const moveExercise = async (index: number, direction: 'up' | 'down') => {
        if (!exercises) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= exercises.length) return;

        const ex1 = exercises[index];
        const ex2 = exercises[newIndex];

        // Swap orders
        await db.workoutExercises.update(ex1.id!, { order: newIndex, updatedAt: Date.now() });
        await db.workoutExercises.update(ex2.id!, { order: index, updatedAt: Date.now() });
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Modern Header with Stats */}
            <div className="bg-gradient-to-br from-accent to-accent-hover text-white shadow-lg">
                <div className="p-6 pb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-2xl font-bold mb-1">Active Workout</h1>
                            <div className="flex items-center gap-3 text-white/90">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={16} />
                                    <span className="font-mono text-lg font-semibold">{workoutDuration}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Dumbbell size={16} />
                                    <span className="font-semibold">{exercises?.length || 0} exercises</span>
                                </div>
                            </div>
                        </div>
                        <Button 
                            size="md" 
                            onClick={handleFinish} 
                            className="bg-white text-accent hover:bg-white/90 font-bold shadow-md gap-2 px-5"
                        >
                            <CheckCircle size={18} /> Finish
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {exercises?.length === 0 && (
                    <div className="text-center py-16 px-6">
                        <div className="bg-bg-tertiary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Dumbbell size={36} className="text-text-tertiary" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-text-primary">No exercises yet</h3>
                        <p className="text-text-secondary mb-6">Add your first exercise to start tracking</p>
                    </div>
                )}

                {exercises?.map((we, index) => (
                    <WorkoutExerciseItem 
                        key={we.uuid} 
                        workoutExercise={we}
                        index={index}
                        totalCount={exercises.length}
                        onDelete={() => deleteExercise(we.id!)}
                        onMoveUp={() => moveExercise(index, 'up')}
                        onMoveDown={() => moveExercise(index, 'down')}
                    />
                ))}

                {/* Large Add Exercise Button */}
                <button
                    onClick={() => setIsPickerOpen(true)}
                    className="w-full py-6 px-6 rounded-2xl border-3 border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-all active:scale-[0.98] group"
                >
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-accent/20 group-hover:bg-accent/30 flex items-center justify-center transition-colors">
                            <Plus size={24} className="text-accent" />
                        </div>
                        <span className="text-lg font-bold text-accent">Add Exercise</span>
                    </div>
                </button>

                {/* Discard Button */}
                {exercises && exercises.length > 0 && (
                    <div className="pt-6 flex justify-center">
                        <button 
                            onClick={cancelWorkout} 
                            className="text-danger hover:text-danger/80 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-danger/5"
                        >
                            <Trash2 size={16} />
                            <span className="font-medium">Discard Workout</span>
                        </button>
                    </div>
                )}
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
const WorkoutExerciseItem: React.FC<{ 
    workoutExercise: WorkoutExercise;
    index: number;
    totalCount: number;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}> = ({ workoutExercise, index, totalCount, onDelete, onMoveUp, onMoveDown }) => {
    const exercise = useLiveQuery(() => db.exercises.where('uuid').equals(workoutExercise.exerciseId).first());

    if (!exercise) return <div className="animate-pulse bg-bg-tertiary h-20 rounded-lg"></div>;

    return (
        <SetList 
            workoutExercise={workoutExercise} 
            exerciseName={exercise.name} 
            isUnilateral={exercise.isUnilateral}
            index={index}
            totalCount={totalCount}
            onDelete={onDelete}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
        />
    );
}
