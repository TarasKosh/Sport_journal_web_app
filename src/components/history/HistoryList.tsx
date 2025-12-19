import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { Calendar, Edit2 } from 'lucide-react';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';

export const HistoryList: React.FC = () => {
    const [editing, setEditing] = React.useState<null | number>(null); // id тренировки для редактирования
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
                        <button
                            className="ml-auto text-accent hover:text-accent-hover transition"
                            title="Edit workout"
                            onClick={() => {
                                setEditing(workout.id);
                                setEditingWorkout(workout);
                            }}
                        >
                            <Edit2 size={18} />
                        </button>
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
                        setEditing(null);
                        setEditingWorkout(null);
                    }}
                    onSaved={() => {
                        setEditing(null);
                        setEditingWorkout(null);
                    }}
                />
            )}

        </div>
    );
};
