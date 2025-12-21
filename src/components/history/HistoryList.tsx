import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { Calendar, Edit2, Trash2 } from 'lucide-react';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';

export const HistoryList: React.FC = () => {
    const [editingWorkout, setEditingWorkout] = React.useState<any>(null); // весь workout

    // Fetch completed workouts descending
    const workouts = useLiveQuery(async () => {
        return await db.workouts
            .orderBy('workoutDay')
            .reverse()
            .filter(w => !!w.endedAt)
            .toArray();
    });

    if (!workouts) return <div className="p-4 text-center">Loading...</div>;

    const workoutDayToDate = (workoutDay: string) => {
        const [y, m, d] = workoutDay.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    };

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
        <div className="flex flex-col gap-3 p-4 pb-20">
            <h1 className="text-xl font-bold mb-2">History</h1>
            {workouts.length === 0 && (
                <div className="text-center text-text-secondary">
                    No completed workouts yet.
                </div>
            )}
            {workouts.map(workout => (
                <Card key={workout.uuid} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                        <Calendar size={14} />
                        <span>{workoutDayToDate(workout.workoutDay).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                className="text-accent hover:text-accent-hover transition"
                                title="Edit workout"
                                onClick={() => {
                                    if (workout.id) {
                                        setEditingWorkout(workout);
                                    }
                                }}
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                className="text-danger hover:text-danger/80 transition"
                                title="Delete workout"
                                onClick={() => handleDeleteWorkout(workout)}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg">{workout.title || "Workout"}</h3>
                        <span className="text-xs bg-bg-tertiary px-2 py-1 rounded">
                            {workout.endedAt ?
                                Math.round((workout.endedAt - workout.startedAt) / 1000 / 60) + ' min'
                                : 'Incomplete'}
                        </span>
                    </div>
                    {/* Potential future expansion: List muscles trained or max volume */}
                </Card>
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
