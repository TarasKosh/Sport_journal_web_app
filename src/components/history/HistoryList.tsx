import React, { useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';
import { WorkoutDetailsView } from './WorkoutDetailsView';
import { WorkoutCard } from './WorkoutCard';
import type { Workout } from '../../types';

export const HistoryList: React.FC = () => {
    const [editingWorkout, setEditingWorkout] = React.useState<Workout | null>(null);
    const [selectedWorkout, setSelectedWorkout] = React.useState<Workout | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    // Fetch completed workouts descending
    const workouts = useLiveQuery(async () => {
        return await db.workouts
            .orderBy('workoutDay')
            .reverse()
            .filter(w => !!w.endedAt)
            .toArray();
    });

    // Save scroll position when leaving list view
    useEffect(() => {
        if (!selectedWorkout && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
    }, [selectedWorkout]);

    // Handle scroll position save
    const handleScroll = () => {
        if (scrollContainerRef.current && !selectedWorkout) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }
    };

    // Handle workout card click
    const handleWorkoutClick = (workout: Workout, e: React.MouseEvent) => {
        // Don't open details if clicking on action buttons
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
            return;
        }
        
        if (scrollContainerRef.current) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }
        setSelectedWorkout(workout);
    };

    // Handle back from details
    const handleBackFromDetails = () => {
        setSelectedWorkout(null);
    };

    if (!workouts) return <div className="p-4 text-center">Loading...</div>;

    // Show workout details if selected
    if (selectedWorkout) {
        return <WorkoutDetailsView workout={selectedWorkout} onBack={handleBackFromDetails} />;
    }

    // Delete workout and all related data (exercises, sets)
    const handleDeleteWorkout = async (workout: any) => {
        if (!workout.id) return;
        
        if (confirm('Delete this workout? This cannot be undone.')) {
            try {
                // Get all workout exercises for this workout
                const workoutExercises = await db.workoutExercises
                    .where('workoutId')
                    .equals(workout.uuid)
                    .toArray();

                // Delete all sets for each exercise
                for (const we of workoutExercises) {
                    const sets = await db.sets
                        .where('workoutExerciseId')
                        .equals(we.uuid)
                        .toArray();
                    if (sets.length > 0) {
                        await db.sets.bulkDelete(sets.map(s => s.id!));
                    }
                }

                // Delete all workout exercises
                if (workoutExercises.length > 0) {
                    await db.workoutExercises.bulkDelete(workoutExercises.map(we => we.id!));
                }

                // Delete the workout itself
                await db.workouts.delete(workout.id);
            } catch (e) {
                console.error('Failed to delete workout', e);
                alert('Failed to delete workout. Please try again.');
            }
        }
    };

    return (
        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex flex-col gap-3 p-4 pb-20 overflow-y-auto h-full"
        >
            <h1 className="text-xl font-bold mb-2">History</h1>
            {workouts.length === 0 && (
                <div className="text-center text-text-secondary">
                    No completed workouts yet.
                </div>
            )}
            {workouts.map(workout => (
                <WorkoutCard
                    key={workout.uuid}
                    workout={workout}
                    onEdit={(w) => {
                        if (w.id) {
                            setEditingWorkout(w);
                        }
                    }}
                    onDelete={handleDeleteWorkout}
                    onClick={handleWorkoutClick}
                />
            ))}
            {editingWorkout && (
                <EditWorkoutModal
                    workout={editingWorkout}
                    isOpen={!!editingWorkout}
                    onClose={() => {
                        setEditingWorkout(null);
                    }}
                    onSaved={() => {
                        setEditingWorkout(null);
                    }}
                />
            )}

        </div>
    );
};
