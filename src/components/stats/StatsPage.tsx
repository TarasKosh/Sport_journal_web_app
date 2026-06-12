import React, { useState } from 'react';
import { Card } from '../common/Card';
import { BarChart2, TrendingUp, Calendar, Dumbbell, Trophy } from 'lucide-react';
import { useStats } from '../../hooks/useStats';
import {
    BarChart,
    LineChart,
    WeightLineChart,
    StackedAreaChart,
    MultiLineChart,
    PieChart,
    formatNumber,
} from './charts';
import type { StatsPeriod } from '../../services/stats';

const PERIODS: { value: StatsPeriod; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: '3months', label: '3 Months' },
    { value: '6months', label: '6 Months' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All' },
];

const MUSCLE_DETAIL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const StatsPage: React.FC = () => {
    const [period, setPeriod] = useState<StatsPeriod>('3months');
    const stats = useStats(period);

    return (
        <div className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold">Statistics</h1>

            {/* Period Filter */}
            <div className="flex overflow-x-auto gap-2 pb-2">
                {PERIODS.map(({ value, label }) => (
                    <button
                        key={value}
                        className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition-colors ${
                            period === value
                                ? 'bg-accent text-white'
                                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                        }`}
                        onClick={() => setPeriod(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {!stats && (
                <Card className="text-center py-10">
                    <Dumbbell className="text-text-tertiary mx-auto mb-4" size={48} />
                    <h2 className="text-lg font-bold mb-2">No Workouts Yet</h2>
                    <p className="text-text-secondary mb-4">Log your first workout to see stats</p>
                </Card>
            )}

            {/* Metric Cards */}
            {stats && (
                <div className="grid grid-cols-2 gap-3">
                    <Card className="flex flex-col items-center justify-center py-4">
                        <TrendingUp className="text-accent mb-1" size={20} />
                        <span className="text-lg font-bold">{stats.totalWorkouts || 0}</span>
                        <span className="text-xs text-text-secondary text-center">Total Workouts</span>
                    </Card>
                    <Card className="flex flex-col items-center justify-center py-4">
                        <BarChart2 className="text-success mb-1" size={20} />
                        <span className="text-lg font-bold">{formatNumber(stats.totalTonnage)}</span>
                        <span className="text-xs text-text-secondary text-center">Total Tonnage (kg)</span>
                    </Card>
                    <Card className="flex flex-col items-center justify-center py-4">
                        <Calendar className="text-info mb-1" size={20} />
                        <span className="text-lg font-bold">{stats.avgWorkoutsPerWeek.toFixed(1)}</span>
                        <span className="text-xs text-text-secondary text-center">Avg/Week</span>
                    </Card>
                    <Card className="flex flex-col items-center justify-center py-4">
                        <Dumbbell className="text-warning mb-1" size={20} />
                        <span className="text-lg font-bold">{`${formatNumber(stats.totalSets)} / ${formatNumber(stats.totalReps)}`}</span>
                        <span className="text-xs text-text-secondary text-center">Sets / Reps</span>
                    </Card>
                    <Card className="flex flex-col items-center justify-center py-4 col-span-2">
                        <Trophy className="text-yellow-500 mb-1" size={20} />
                        <span className="text-lg font-bold">{stats.prCount || 0}</span>
                        <span className="text-xs text-text-secondary text-center">Personal Records</span>
                    </Card>
                </div>
            )}

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

            <Card>
                <h2 className="font-bold mb-4">Workouts Over Time</h2>
                <BarChart data={stats?.workoutsOverTime || []} />
            </Card>

            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-success" size={20} />
                    <h2 className="font-bold">Body Weight Over Time (kg)</h2>
                </div>
                <WeightLineChart data={stats?.bodyWeightOverTime || []} />
            </Card>

            <Card>
                <h2 className="font-bold mb-4">Tonnage Over Time</h2>
                <LineChart data={stats?.tonnageOverTime || []} />
            </Card>

            <Card>
                <h2 className="font-bold mb-4">Muscle Distribution Over Time (Stacked)</h2>
                <StackedAreaChart data={stats?.muscleDistributionOverTime || []} />
            </Card>

            <Card>
                <h2 className="font-bold mb-4">Muscle Volume Trends</h2>
                <MultiLineChart data={stats?.muscleDistributionOverTime || []} />
            </Card>

            <Card>
                <h2 className="font-bold mb-4">Muscle Distribution</h2>
                <PieChart data={stats?.muscleDistribution.map(item => ({ name: item.name, volume: item.volume })) || []} />

                <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                    {stats?.muscleDistribution.slice(0, 6).map((item, index) => (
                        <div key={index} className="border border-border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: MUSCLE_DETAIL_COLORS[index % MUSCLE_DETAIL_COLORS.length] }}
                                />
                                <span className="font-medium capitalize">{item.name}</span>
                                <span className="text-sm text-text-secondary ml-auto">{formatNumber(item.volume)}</span>
                            </div>
                            <div className="space-y-1 ml-5">
                                {item.topExercises.map((exercise, exIndex) => (
                                    <div key={exIndex} className="flex justify-between text-sm">
                                        <span className="text-text-secondary truncate">{exercise.name}</span>
                                        <span className="ml-2">{formatNumber(exercise.volume)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};
