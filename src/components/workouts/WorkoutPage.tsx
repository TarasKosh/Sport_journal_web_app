import React, { useState } from 'react';
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
                updatedAt: now
            });
        } catch (e) {
            console.error("Failed to start workout", e);
        }
    };

    const handleSaveFinished = () => {
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
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
                <div className="bg-bg-tertiary p-8 rounded-full">
                    <CheckCircle size={52} className="text-success" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">Workout Finished</h1>
                    <p className="text-text-secondary">
                        {finishedWorkout ? 'Saved to history.' : 'Loading...'}
                    </p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Button size="lg" onClick={handleSaveFinished} fullWidth className="shadow-lg">
                        Save
                    </Button>
                    <Button size="lg" variant="secondary" onClick={handleStartWorkout} fullWidth>
                        Start
                    </Button>
                    <Button size="lg" variant="danger" onClick={handleDiscardFinished} fullWidth className="gap-2">
                        <Trash2 size={18} /> Discard
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
