import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../common/Button';
import { Play } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ActiveWorkoutView } from './ActiveWorkoutView';

export const WorkoutPage: React.FC = () => {
    // Query for an active workout (endedAt is undefined or null)
    // We use toArray and find because simple 'where' with undefined is tricky in some Dexie versions, 
    // but Filter is safe.
    const activeWorkout = useLiveQuery(async () => {
        // Optimization: In real app, we might want an index on startedAt/endedAt
        // But since there's usually 0 or 1 active workout, filtering all workouts is not efficient if history is huge.
        // Better to have 'active' table or index.
        // For MVP: filter.
        const active = await db.workouts
            .filter(w => !w.endedAt)
            .first();
        return active;
    });

    const handleStartWorkout = async () => {
        try {
            await db.workouts.add({
                uuid: uuidv4(),
                startedAt: Date.now(),
                updatedAt: Date.now()
            });
        } catch (e) {
            console.error("Failed to start workout", e);
        }
    };

    if (activeWorkout) {
        return <ActiveWorkoutView workout={activeWorkout} />;
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-bg-tertiary p-8 rounded-full">
                <Play size={48} className="text-accent ml-2" />
            </div>
            <div>
                <h1 className="text-2xl font-bold mb-2">Ready to Train?</h1>
                <p className="text-text-secondary">Start a new workout to log your sets.</p>
            </div>
            <Button size="lg" onClick={handleStartWorkout} fullWidth className="max-w-xs shadow-lg shadow-accent/20">
                Start Workout
            </Button>
        </div>
    );
};
