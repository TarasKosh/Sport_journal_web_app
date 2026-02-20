import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../common/Button';
import { Calendar, CheckCircle, Play, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ActiveWorkoutView } from './ActiveWorkoutView';
import { WorkoutDayPickerModal } from './WorkoutDayPickerModal';

export const WorkoutPage: React.FC = () => {
    const [finishedWorkoutUuid, setFinishedWorkoutUuid] = useState<string | null>(null);
    const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<string>(() => toDayString(new Date()));
    const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
    const [draftWorkoutDay, setDraftWorkoutDay] = useState<string>(selectedWorkoutDay);

    // Pre-workout inputs (on start screen)
    const [startBodyWeight, setStartBodyWeight] = useState<string>('');

    // Post-workout notes (on finish screen)
    const [notesInput, setNotesInput] = useState<string>('');

    // Query for an active workout (endedAt is undefined or null)
    // Query for active workouts (should be 0 or 1)
    const activeWorkouts = useLiveQuery(async () => {
        return await db.workouts
            .filter(w => !w.endedAt)
            .toArray();
    });

    const finishedWorkout = useLiveQuery(async () => {
        if (!finishedWorkoutUuid) return null;
        return await db.workouts.where('uuid').equals(finishedWorkoutUuid).first();
    }, [finishedWorkoutUuid]);

    // Update local state when finishedWorkout loads (notes only)
    useEffect(() => {
        if (finishedWorkout) {
            setNotesInput(finishedWorkout.notes || '');
        }
    }, [finishedWorkout]);

    const workoutsForSelectedDay = useLiveQuery(async () => {
        return await db.workouts
            .where('workoutDay')
            .equals(selectedWorkoutDay)
            .filter(w => !!w.endedAt)
            .toArray();
    }, [selectedWorkoutDay]);

    const handleStartWorkout = async () => {
        try {
            setFinishedWorkoutUuid(null);
            const now = Date.now();
            const workoutDay = selectedWorkoutDay || toDayString(new Date(now));
            await db.workouts.add({
                uuid: uuidv4(),
                startedAt: now,
                workoutDay,
                // Save body weight at the start so it's available during the workout
                bodyWeight: startBodyWeight ? parseFloat(startBodyWeight) : undefined,
                updatedAt: now
            });
        } catch (e) {
            console.error("Failed to start workout", e);
        }
    };

    const handleSaveFinished = async () => {
        if (finishedWorkout) {
            await db.workouts.update(finishedWorkout.id!, {
                notes: notesInput.trim() || undefined,
                updatedAt: Date.now()
            });
        }
        setFinishedWorkoutUuid(null);
    };

    const handleDiscardFinished = async () => {
        if (!finishedWorkout) {
            setFinishedWorkoutUuid(null);
            return;
        }
        if (confirm('Delete this workout? This cannot be undone.')) {
            await db.workouts.delete(finishedWorkout.id!);
            setFinishedWorkoutUuid(null);
        }
    };

    if (activeWorkouts === undefined) {
        return <div className="p-4 text-center mt-10">Loading...</div>;
    }

    const activeWorkout = activeWorkouts[0];

    if (activeWorkout) {
        return (
            <ActiveWorkoutView
                workout={activeWorkout}
                onFinished={(uuid) => {
                    setSelectedWorkoutDay(activeWorkout.workoutDay);
                    setFinishedWorkoutUuid(uuid);
                }}
                onDiscarded={() => setFinishedWorkoutUuid(null)}
            />
        );
    }

    if (finishedWorkoutUuid) {
        return (
            <div className="flex flex-col items-center flex-1 h-full p-6 space-y-6 overflow-y-auto pb-24">
                <div className="bg-bg-tertiary p-6 rounded-full mt-4">
                    <CheckCircle size={48} className="text-success" />
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-1 text-text-primary">Workout Finished!</h1>
                    <p className="text-text-secondary text-sm">
                        {finishedWorkout ? 'Great job! Add any final details.' : 'Loading...'}
                    </p>
                </div>

                {finishedWorkout && (
                    <div className="w-full max-w-xs flex flex-col gap-4 text-left mt-2">
                        <div>
                            <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wide">Workout Notes</label>
                            <textarea
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border/60 focus:border-accent outline-none text-text-primary resize-none"
                                placeholder="How did you feel today?"
                                value={notesInput}
                                onChange={e => setNotesInput(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
                    <Button size="lg" onClick={handleSaveFinished} fullWidth className="shadow-lg font-bold">
                        Save to History
                    </Button>
                    <Button size="md" variant="danger" onClick={handleDiscardFinished} fullWidth className="gap-2 mt-4 bg-transparent text-danger hover:bg-danger/10 shadow-none border border-danger/20">
                        <Trash2 size={18} /> Discard Workout
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
            <div className="bg-bg-tertiary p-8 rounded-full">
                <Play size={48} className="text-accent ml-2" />
            </div>
            <div>
                {workoutsForSelectedDay && workoutsForSelectedDay.length > 0 && (
                    <div className="w-full max-w-md pt-2">
                        <p className="text-text-secondary">You have already logged workouts for this day.</p>
                    </div>
                )}
                <p className="text-text-secondary">Start a new workout to log your sets.</p>
            </div>

            <button
                onClick={() => {
                    setDraftWorkoutDay(selectedWorkoutDay);
                    setIsDayPickerOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border hover:bg-bg-tertiary transition-colors"
            >
                <Calendar size={18} className="text-text-secondary" />
                <span className="font-medium">{workoutDayToDate(selectedWorkoutDay).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </button>

            {/* Body weight input before starting */}
            <div className="w-full max-w-xs">
                <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wide text-left">Body Weight (kg)</label>
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border/60 focus:border-accent outline-none text-text-primary font-medium text-center text-lg"
                    placeholder="e.g. 75.5"
                    value={startBodyWeight}
                    onChange={e => setStartBodyWeight(e.target.value)}
                />
            </div>

            <Button size="lg" onClick={handleStartWorkout} fullWidth className="max-w-xs shadow-lg shadow-accent/20">
                Start
            </Button>
            <WorkoutDayPickerModal
                isOpen={isDayPickerOpen}
                value={draftWorkoutDay}
                onClose={() => setIsDayPickerOpen(false)}
                onChange={setDraftWorkoutDay}
                onToday={() => setDraftWorkoutDay(toDayString(new Date()))}
                onApply={() => {
                    setSelectedWorkoutDay(draftWorkoutDay);
                    setIsDayPickerOpen(false);
                }}
            />
        </div>
    );
};

// Helper function to convert date to string in the format 'YYYY-MM-DD'
function toDayString(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function workoutDayToDate(workoutDay: string) {
    const [y, m, d] = workoutDay.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
