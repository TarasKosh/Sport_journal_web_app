import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { Calendar } from 'lucide-react';

export const HistoryList: React.FC = () => {
    // Fetch completed workouts descending
    const workouts = useLiveQuery(async () => {
        // We need an index on startedAt to sort efficiently. 
        // Our schema has startedAt.
        // reverse() to show newest first.
        return await db.workouts
            .where('startedAt').above(0) // Just to get a collection to sort? Or use orderBy directly
            .and(w => !!w.endedAt) // Filter completed
            .reverse() // Dexie collection reverse is not always sorting by index unless specified
            .sortBy('startedAt');
    });

    if (!workouts) return <div className="p-4 text-center">Loading...</div>;

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
                        <span>{new Date(workout.startedAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
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
        </div>
    );
};
