import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../common/Button';
import { CheckCircle, Play, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ActiveWorkoutView } from './ActiveWorkoutView';

export const WorkoutPage: React.FC = () => {
    const [finishedWorkoutUuid, setFinishedWorkoutUuid] = useState<string | null>(null);

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

    const handleStartWorkout = async () => {
        try {
            setFinishedWorkoutUuid(null);
            await db.workouts.add({
                uuid: uuidv4(),
                startedAt: Date.now(),
                updatedAt: Date.now()
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
                onFinished={(uuid) => setFinishedWorkoutUuid(uuid)}
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
                <h1 className="text-2xl font-bold mb-2">Ready to Train?</h1>
                <p className="text-text-secondary">Start a new workout to log your sets.</p>
            </div>
            <Button size="lg" onClick={handleStartWorkout} fullWidth className="max-w-xs shadow-lg shadow-accent/20">
                Start
            </Button>
        </div>
    );
};
