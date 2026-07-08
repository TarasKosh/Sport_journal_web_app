import React, { useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';
import { WorkoutDetailsView } from './WorkoutDetailsView';
import { WorkoutCard } from './WorkoutCard';
import type { Workout } from '../../types';
import { softDeleteWorkout } from '../../services/data/softDelete';
import { useToast } from '../../hooks/useToast';

export const HistoryList: React.FC = () => {
    const { showToast } = useToast();
    const [editingWorkout, setEditingWorkout] = React.useState<Workout | null>(null);
    const [selectedWorkout, setSelectedWorkout] = React.useState<Workout | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    // Fetch completed workouts descending (exclude soft-deleted)
    const workouts = useLiveQuery(async () => {
        return await db.workouts
            .orderBy('workoutDay')
            .reverse()
            .filter(w => !!w.endedAt && w.deletedAt == null)
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
    const handleWorkoutClick = useCallback((workout: Workout, e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
            return;
        }
        
        if (scrollContainerRef.current) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }
        setSelectedWorkout(workout);
    }, []);

    // Handle back from details
    const handleBackFromDetails = () => {
        setSelectedWorkout(null);
    };

    const handleEditWorkout = useCallback((w: Workout) => {
        if (w.id) {
            setEditingWorkout(w);
        }
    }, []);

    const handleDeleteWorkout = useCallback(async (workout: Workout) => {
        if (!workout.id) return;

        if (confirm('Delete this workout? It will be removed on this device and after the next sync.')) {
            try {
                await softDeleteWorkout(workout.id);
                showToast('Workout deleted', 'success');
            } catch (e) {
                console.error('Failed to delete workout', e);
                showToast('Failed to delete workout. Please try again.', 'error');
            }
        }
    }, [showToast]);

    if (!workouts) return <div className="p-4 text-center">Loading...</div>;

    if (selectedWorkout) {
        return <WorkoutDetailsView workout={selectedWorkout} onBack={handleBackFromDetails} />;
    }

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
                    onEdit={handleEditWorkout}
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
