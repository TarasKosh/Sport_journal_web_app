import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { BarChart2, TrendingUp, Calendar } from 'lucide-react';

export const StatsPage: React.FC = () => {
    // Stats calculation
    const stats = useLiveQuery(async () => {
        const workouts = await db.workouts.toArray();
        const sets = await db.sets.toArray();

        const completedWorkouts = workouts.filter(w => !!w.endedAt);
        const totalWorkouts = completedWorkouts.length;

        // Tonnage
        const totalTonnage = sets.reduce((acc, s) => acc + (s.weight * s.reps), 0);

        // This Week
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0, 0, 0, 0);
        const thisWeekWorkouts = completedWorkouts.filter(w => w.startedAt >= startOfWeek);

        return {
            totalWorkouts,
            totalTonnage,
            thisWeekCount: thisWeekWorkouts.length
        };
    });

    return (
        <div className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold">Statistics</h1>

            <div className="grid grid-cols-2 gap-3">
                <Card className="flex flex-col items-center justify-center py-6">
                    <TrendingUp className="text-accent mb-2" />
                    <span className="text-2xl font-bold">{stats?.totalWorkouts || 0}</span>
                    <span className="text-xs text-text-secondary">Total Workouts</span>
                </Card>
                <Card className="flex flex-col items-center justify-center py-6">
                    <BarChart2 className="text-success mb-2" />
                    <span className="text-2xl font-bold">{(stats?.totalTonnage || 0) / 1000}k</span>
                    <span className="text-xs text-text-secondary">Total Tonnage (kg)</span>
                </Card>
            </div>

            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="text-text-secondary" size={20} />
                    <h2 className="font-bold">This Week</h2>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                    <span>Workouts Completed</span>
                    <span className="font-bold">{stats?.thisWeekCount || 0}</span>
                </div>
                <div className="mt-4 text-xs text-text-secondary">
                    Keep consistent to see progress!
                </div>
            </Card>

            {/* Placeholder for Muscle Distribution Chart */}
            <Card>
                <h2 className="font-bold mb-4">Muscle Distribution</h2>
                <div className="h-40 flex items-center justify-center text-text-tertiary bg-mid opacity-20 rounded">
                    Chart Placeholder
                </div>
            </Card>
        </div>
    );
};
