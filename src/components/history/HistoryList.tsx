import React, { useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { WorkoutRepository } from '../../data/repositories/WorkoutRepository';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';
import { WorkoutDetailsView } from './WorkoutDetailsView';
import { WorkoutCard } from './WorkoutCard';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { Workout } from '../../types';
import { useToast } from '../../hooks/useToast';

/** Finished workouts fetched per page. */
const PAGE_SIZE = 20;

export const HistoryList: React.FC = () => {
    const { showToast } = useToast();
    const [editingWorkout, setEditingWorkout] = React.useState<Workout | null>(null);
    const [selectedWorkout, setSelectedWorkout] = React.useState<Workout | null>(null);
    const [workoutToDelete, setWorkoutToDelete] = React.useState<Workout | null>(null);
    const [pageCount, setPageCount] = React.useState(1);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    // Finished workouts descending (newest day first). Growing the page size loads more.
    const workouts = useLiveQuery(
        () => WorkoutRepository.listFinishedPage(0, pageCount * PAGE_SIZE),
        [pageCount],
    );
    const total = useLiveQuery(() => WorkoutRepository.countFinished(), []);

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

    const handleEditWorkout = useCallback((workout: Workout) => {
        if (workout.uuid) {
            setEditingWorkout(workout);
        }
    }, []);

    // Open the delete confirmation dialog for a workout
    const handleDeleteWorkout = useCallback((workout: Workout) => {
        setWorkoutToDelete(workout);
    }, []);

    // Soft-delete the workout once the user confirms
    const confirmDeleteWorkout = useCallback(async () => {
        const workout = workoutToDelete;
        setWorkoutToDelete(null);
        if (!workout) return;

        try {
            await WorkoutRepository.softDelete(workout.uuid);
            showToast('Workout deleted', 'success');
        } catch (e) {
            console.error('Failed to delete workout', e);
            showToast('Failed to delete workout. Please try again.', 'error');
        }
    }, [workoutToDelete, showToast]);

    if (!workouts) return <div className="p-4 text-center">Loading...</div>;

    if (selectedWorkout) {
        return <WorkoutDetailsView workout={selectedWorkout} onBack={handleBackFromDetails} />;
    }

    const loadedCount = workouts.length;
    const hasMore = total != null && loadedCount < total;

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
            {hasMore && (
                <button
                    onClick={() => setPageCount(count => count + 1)}
                    className="w-full py-3 px-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-semibold transition-colors"
                >
                    Load more
                </button>
            )}
            {/* Metadata saves on blur/change; onSaved intentionally does not close the modal. */}
            {editingWorkout && (
                <EditWorkoutModal
                    workout={editingWorkout}
                    isOpen={!!editingWorkout}
                    onClose={() => {
                        setEditingWorkout(null);
                    }}
                />
            )}
            <ConfirmDialog
                isOpen={workoutToDelete !== null}
                title="Delete workout"
                description="Delete this workout? It will be removed on this device and after the next sync."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmDeleteWorkout}
                onClose={() => setWorkoutToDelete(null)}
            />

        </div>
    );
};
