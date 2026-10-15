import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Workout } from '../../types';
import { Button } from '../common/Button';
import { Plus, CheckCircle, Trash2, Clock, Dumbbell } from 'lucide-react';

import { ExercisePickerModal } from './ExercisePickerModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { SetList } from './WorkoutSetList';
import { useWorkoutEditor } from '../../hooks/useWorkoutEditor';
import { WorkoutRepository } from '../../data/repositories/WorkoutRepository';

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
    const [confirmDeleteExerciseUuid, setConfirmDeleteExerciseUuid] = useState<string | null>(null);

    const { workoutExercises, exerciseIndex, addExercise, addTemplate, moveExercise, removeExercise } =
        useWorkoutEditor(workout.uuid);

    const confirmDiscardTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        return () => {
            if (confirmDiscardTimerRef.current) clearTimeout(confirmDiscardTimerRef.current);
            if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
        };
    }, []);

    const handleAddExercise = useCallback(async (exerciseUuid: string) => {
        try {
            await addExercise(exerciseUuid);
            setIsPickerOpen(false);
        } catch (e) {
            console.error("Failed to add exercise", e);
        }
    }, [addExercise]);

    const handleAddTemplate = useCallback(async (templateUuid: string) => {
        try {
            await addTemplate(templateUuid);
            setIsTemplatePickerOpen(false);
        } catch (e) {
            console.error("Failed to add template", e);
        }
    }, [addTemplate]);

    const handleFinish = useCallback(async () => {
        await WorkoutRepository.finish(workout.uuid);
        onFinished?.(workout.uuid);
    }, [workout.uuid, onFinished]);

    const cancelWorkout = useCallback(async () => {
        if (!confirmDiscard) {
            setConfirmDiscard(true);
            if (confirmDiscardTimerRef.current) clearTimeout(confirmDiscardTimerRef.current);
            confirmDiscardTimerRef.current = setTimeout(() => setConfirmDiscard(false), 3000);
            return;
        }
        await WorkoutRepository.softDelete(workout.uuid);
        onDiscarded?.(workout.uuid);
    }, [workout.uuid, onDiscarded, confirmDiscard]);

    const deleteExercise = useCallback(async (workoutExerciseUuid: string) => {
        if (confirmDeleteExerciseUuid !== workoutExerciseUuid) {
            setConfirmDeleteExerciseUuid(workoutExerciseUuid);
            if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
            confirmDeleteTimerRef.current = setTimeout(() => setConfirmDeleteExerciseUuid(null), 3000);
            return;
        }

        await removeExercise(workoutExerciseUuid);
        setConfirmDeleteExerciseUuid(null);
    }, [confirmDeleteExerciseUuid, removeExercise]);

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
                                    <span className="font-semibold">{workoutExercises?.length || 0} exercises</span>
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
                {workoutExercises?.length === 0 && (
                    <div className="text-center py-16 px-6">
                        <div className="bg-bg-tertiary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Dumbbell size={36} className="text-text-tertiary" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-text-primary">No exercises yet</h3>
                        <p className="text-text-secondary mb-6">Add your first exercise to start tracking</p>
                    </div>
                )}

                {workoutExercises?.map((workoutExercise, index) => (
                    <SetList
                        key={workoutExercise.uuid}
                        workoutExercise={workoutExercise}
                        exercise={exerciseIndex.get(workoutExercise.exerciseId)}
                        index={index}
                        totalCount={workoutExercises.length}
                        onDelete={deleteExercise}
                        isConfirmingDelete={confirmDeleteExerciseUuid === workoutExercise.uuid}
                        onMove={moveExercise}
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
