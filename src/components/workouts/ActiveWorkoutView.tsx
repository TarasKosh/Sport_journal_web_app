import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Exercise, Workout } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { Plus, CheckCircle, Trash2, Clock, Dumbbell } from 'lucide-react';

import { ExercisePickerModal } from './ExercisePickerModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { v4 as uuidv4 } from 'uuid';
import { SetList } from './WorkoutSetList';

const WorkoutTimer: React.FC<{ startedAt: number }> = React.memo(({ startedAt }) => {
    const [duration, setDuration] = useState(() => Date.now() - startedAt);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setDuration(Date.now() - startedAt);
        }, 1000);
        return () => clearInterval(interval);
    }, [startedAt]);

    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formatted = hours > 0
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return <span className="font-mono text-lg font-semibold">{formatted}</span>;
});

export const ActiveWorkoutView: React.FC<{ workout: Workout; onFinished?: (workoutUuid: string) => void; onDiscarded?: (workoutUuid: string) => void }> = ({ workout, onFinished, onDiscarded }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

    // Two-tap confirm states
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [confirmDeleteExerciseId, setConfirmDeleteExerciseId] = useState<number | null>(null);

    const exercises = useLiveQuery(async () => {
        const list = await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
        return list.sort((a, b) => a.order - b.order);
    }, [workout.uuid]);

    const allExercises = useLiveQuery(() => db.exercises.toArray(), []);
    const exerciseMap = useMemo(() => {
        const map = new Map<string, Exercise>();
        for (const ex of allExercises ?? []) map.set(ex.uuid, ex);
        return map;
    }, [allExercises]);

    const exercisesRef = useRef(exercises);
    useEffect(() => { exercisesRef.current = exercises; }, [exercises]);

    const confirmDiscardTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        return () => {
            if (confirmDiscardTimerRef.current) clearTimeout(confirmDiscardTimerRef.current);
            if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
        };
    }, []);

    const handleAddExercise = useCallback(async (exerciseId: string) => {
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
    }, [workout.uuid]);

    const handleAddTemplate = useCallback(async (templateId: string) => {
        try {
            const template = await db.workoutTemplates.where('uuid').equals(templateId).first();
            if (!template) return;

            const count = await db.workoutExercises.where('workoutId').equals(workout.uuid).count();

            // Add all exercises from template
            for (let i = 0; i < template.exercises.length; i++) {
                await db.workoutExercises.add({
                    uuid: uuidv4(),
                    workoutId: workout.uuid,
                    exerciseId: template.exercises[i],
                    order: count + i,
                    updatedAt: Date.now()
                });
            }

            setIsTemplatePickerOpen(false);
        } catch (e) {
            console.error("Failed to add template", e);
        }
    }, [workout.uuid]);

    const handleFinish = useCallback(async () => {
        await db.workouts.update(workout.id!, {
            endedAt: Date.now(),
            updatedAt: Date.now()
        });
        onFinished?.(workout.uuid);
    }, [workout.id, workout.uuid, onFinished]);

    const cancelWorkout = useCallback(async () => {
        if (!confirmDiscard) {
            setConfirmDiscard(true);
            if (confirmDiscardTimerRef.current) clearTimeout(confirmDiscardTimerRef.current);
            confirmDiscardTimerRef.current = setTimeout(() => setConfirmDiscard(false), 3000);
            return;
        }
        await db.workouts.delete(workout.id!);
        onDiscarded?.(workout.uuid);
    }, [workout.id, workout.uuid, onDiscarded, confirmDiscard]);

    const deleteExercise = useCallback(async (workoutExerciseId: number) => {
        if (confirmDeleteExerciseId !== workoutExerciseId) {
            setConfirmDeleteExerciseId(workoutExerciseId);
            if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
            confirmDeleteTimerRef.current = setTimeout(() => setConfirmDeleteExerciseId(null), 3000);
            return;
        }

        const currentExercises = exercisesRef.current;
        const we = currentExercises?.find(e => e.id === workoutExerciseId);
        if (!we) return;

        const now = Date.now();
        // Delete all sets for this exercise
        const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
        await db.sets.bulkDelete(sets.map(s => s.id!));
        // Delete the workout exercise
        await db.workoutExercises.delete(workoutExerciseId);
        // Reorder remaining exercises
        if (currentExercises) {
            const remaining = currentExercises.filter(e => e.id !== workoutExerciseId);
            for (let i = 0; i < remaining.length; i++) {
                await db.workoutExercises.update(remaining[i].id!, { order: i, updatedAt: now });
            }
        }
        setConfirmDeleteExerciseId(null);
    }, [confirmDeleteExerciseId]);

    const moveExercise = useCallback(async (index: number, direction: 'up' | 'down') => {
        const currentExercises = exercisesRef.current;
        if (!currentExercises) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= currentExercises.length) return;

        const ex1 = currentExercises[index];
        const ex2 = currentExercises[newIndex];

        const now = Date.now();
        // Swap orders
        await db.workoutExercises.update(ex1.id!, { order: newIndex, updatedAt: now });
        await db.workoutExercises.update(ex2.id!, { order: index, updatedAt: now });
    }, []);

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
                                    <WorkoutTimer startedAt={workout.startedAt} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Dumbbell size={16} />
                                    <span className="font-semibold">{exercises?.length || 0} exercises</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={cancelWorkout}
                                className={`h-11 px-3 rounded-xl flex items-center justify-center transition-colors gap-2 font-bold text-sm ${confirmDiscard
                                    ? 'bg-danger text-white hover:bg-danger/90'
                                    : 'bg-white/15 text-white hover:bg-white/25 w-11'
                                    }`}
                                title="Discard Workout"
                            >
                                <Trash2 size={18} />
                                {confirmDiscard && <span>Sure?</span>}
                            </button>
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
                        <SetList
                            key={we.uuid}
                            workoutExercise={we}
                            exercise={exerciseMap.get(we.exerciseId)}
                            index={index}
                            totalCount={exercises.length}
                            onDelete={deleteExercise}
                            workoutExerciseId={we.id!}
                            isConfirmingDelete={confirmDeleteExerciseId === we.id}
                            onMoveUp={moveExercise}
                            onMoveDown={moveExercise}
                        />
                    ))}

                {/* Add Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setIsTemplatePickerOpen(true)}
                        className="py-5 px-4 rounded-2xl border-2 border-accent bg-accent/5 hover:bg-accent/10 hover:border-accent transition-all active:scale-[0.98]"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                                <Dumbbell size={20} className="text-accent" />
                            </div>
                            <span className="text-sm font-bold text-accent">Add Template</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setIsPickerOpen(true)}
                        className="py-5 px-4 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-all active:scale-[0.98]"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                                <Plus size={20} className="text-accent" />
                            </div>
                            <span className="text-sm font-bold text-accent">Add Exercise</span>
                        </div>
                    </button>
                </div>

            </div>

            <ExercisePickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={handleAddExercise}
            />

            <TemplatePickerModal
                isOpen={isTemplatePickerOpen}
                onClose={() => setIsTemplatePickerOpen(false)}
                onSelect={handleAddTemplate}
            />
        </div>
    );
};


