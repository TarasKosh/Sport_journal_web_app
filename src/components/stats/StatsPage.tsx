import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { BarChart2, TrendingUp, Calendar, Dumbbell, Trophy } from 'lucide-react';
import type { Workout, SetEntry, Exercise, WorkoutExercise } from '../../types';

interface MuscleDistribution {
    name: string;
    volume: number;
    topExercises: { name: string; volume: number }[];
}

interface MuscleWeekData {
    week: string;
    muscles: Record<string, number>;
}

interface Stats {
    totalWorkouts: number;
    totalTonnage: number;
    totalSets: number;
    totalReps: number;
    avgWorkoutsPerWeek: number;
    thisWeekCount: number;
    muscleDistribution: MuscleDistribution[];
    workoutsOverTime: { week: string; count: number }[];
    tonnageOverTime: { week: string; tonnage: number }[];
    muscleDistributionOverTime: MuscleWeekData[];
    prCount: number;
    bodyWeightOverTime: { week: string; weight: number }[];
}

// Helper function to format large numbers
const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
};

// Helper function to filter workouts by period
const filterWorkoutsByPeriod = (workouts: Workout[], period: string): Workout[] => {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
        case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        case '3months':
            startDate.setMonth(now.getMonth() - 3);
            break;
        case '6months':
            startDate.setMonth(now.getMonth() - 6);
            break;
        case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
        default:
            return workouts; // No filtering
    }

    const startTimestamp = startDate.getTime();
    return workouts.filter(workout => (workout.startedAt || 0) >= startTimestamp);
};

// Helper function to calculate average workouts per week
const calculateAvgWorkoutsPerWeek = (workouts: Workout[], period: string): number => {
    if (workouts.length === 0) return 0;

    let weeks = 1;
    switch (period) {
        case 'week':
            weeks = 1;
            break;
        case 'month':
            weeks = 4;
            break;
        case '3months':
            weeks = 12;
            break;
        case '6months':
            weeks = 24;
            break;
        case 'year':
            weeks = 52;
            break;
        case 'all':
            if (workouts.length > 0) {
                const firstWorkoutDate = new Date(Math.min(...workouts.map(w => w.startedAt || 0)));
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - firstWorkoutDate.getTime());
                weeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
            }
            break;
    }

    return workouts.length / weeks;
};

// Helper function to calculate muscle distribution
const calculateMuscleDistribution = (sets: SetEntry[], workoutExercises: WorkoutExercise[], exercises: Exercise[]): MuscleDistribution[] => {
    const muscleGroups: Record<string, { volume: number; exercises: Record<string, number> }> = {};

    // Create maps for quick lookup
    const exerciseMap: Record<string, Exercise> = {};
    exercises.forEach(exercise => {
        exerciseMap[exercise.uuid] = exercise;
    });

    // Calculate volume per muscle group and track exercises
    sets.forEach(set => {
        const workoutExercise = workoutExercises.find(we => we.uuid === set.workoutExerciseId);
        if (workoutExercise) {
            const exercise = exerciseMap[workoutExercise.exerciseId];
            if (exercise) {
                const muscleGroup = exercise.muscleGroup;
                const exerciseName = exercise.name;
                const volume = set.weight * set.reps;

                if (!muscleGroups[muscleGroup]) {
                    muscleGroups[muscleGroup] = { volume: 0, exercises: {} };
                }

                muscleGroups[muscleGroup].volume += volume;

                if (!muscleGroups[muscleGroup].exercises[exerciseName]) {
                    muscleGroups[muscleGroup].exercises[exerciseName] = 0;
                }
                muscleGroups[muscleGroup].exercises[exerciseName] += volume;
            }
        }
    });

    // Convert to array and sort by volume
    return Object.entries(muscleGroups)
        .map(([name, data]) => ({
            name,
            volume: data.volume,
            topExercises: Object.entries(data.exercises)
                .map(([exerciseName, exerciseVolume]) => ({ name: exerciseName, volume: exerciseVolume }))
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 5) // Top 5 exercises per muscle group
        }))
        .sort((a, b) => b.volume - a.volume);
};

// Helper function to calculate workouts over time (weekly)
const calculateWorkoutsOverTime = (workouts: Workout[]) => {
    const weeklyData: Record<string, number> = {};

    workouts.forEach(workout => {
        if (workout.startedAt) {
            const date = new Date(workout.startedAt);
            // Get the Monday of the week
            const monday = new Date(date);
            const day = monday.getDay();
            const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            monday.setDate(diff);

            const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
        }
    });

    // Convert to array
    return Object.entries(weeklyData)
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => {
            const [yearA, monthA, dayA] = a.week.split('-').map(Number);
            const [yearB, monthB, dayB] = b.week.split('-').map(Number);
            const dateA = new Date(yearA, monthA, dayA);
            const dateB = new Date(yearB, monthB, dayB);
            return dateA.getTime() - dateB.getTime();
        });
};

// Helper function to calculate tonnage over time (weekly)
const calculateTonnageOverTime = (sets: SetEntry[], workoutExercises: WorkoutExercise[], workouts: Workout[]) => {
    const weeklyData: Record<string, number> = {};

    // Create a map of workoutExerciseId to workoutId
    const workoutExerciseMap: Record<string, string> = {};
    workoutExercises.forEach(we => {
        workoutExerciseMap[we.uuid] = we.workoutId;
    });

    // Create a map of workoutId to startedAt
    const workoutMap: Record<string, number> = {};
    workouts.forEach(workout => {
        workoutMap[workout.uuid] = workout.startedAt || 0;
    });

    sets.forEach(set => {
        const workoutId = workoutExerciseMap[set.workoutExerciseId];
        if (workoutId) {
            const startedAt = workoutMap[workoutId];
            if (startedAt) {
                const date = new Date(startedAt);
                // Get the Monday of the week
                const monday = new Date(date);
                const day = monday.getDay();
                const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                monday.setDate(diff);

                const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
                const tonnage = set.weight * set.reps;
                weeklyData[weekKey] = (weeklyData[weekKey] || 0) + tonnage;
            }
        }
    });

    // Convert to array
    return Object.entries(weeklyData)
        .map(([week, tonnage]) => ({ week, tonnage }))
        .sort((a, b) => {
            const [yearA, monthA, dayA] = a.week.split('-').map(Number);
            const [yearB, monthB, dayB] = b.week.split('-').map(Number);
            const dateA = new Date(yearA, monthA, dayA);
            const dateB = new Date(yearB, monthB, dayB);
            return dateA.getTime() - dateB.getTime();
        });
};

// Helper function to calculate body weight over time (one point per workout)
const calculateBodyWeightOverTime = (workouts: Workout[]) => {
    return workouts
        .filter(w => w.startedAt && w.bodyWeight && w.bodyWeight > 0 && w.bodyWeight < 500)
        .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
        .map(w => {
            const date = new Date(w.startedAt!);
            const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return { week: label, weight: w.bodyWeight! };
        });
};


// Helper function to calculate muscle distribution over time (weekly breakdown by muscle group)
const calculateMuscleDistributionOverTime = (
    sets: SetEntry[],
    workoutExercises: WorkoutExercise[],
    workouts: Workout[],
    exercises: Exercise[]
): MuscleWeekData[] => {
    // Create lookup maps
    const exerciseMap: Record<string, Exercise> = {};
    exercises.forEach(e => { exerciseMap[e.uuid] = e; });

    const weToWorkoutId: Record<string, string> = {};
    const weToExerciseId: Record<string, string> = {};
    workoutExercises.forEach(we => {
        weToWorkoutId[we.uuid] = we.workoutId;
        weToExerciseId[we.uuid] = we.exerciseId;
    });

    const workoutStartMap: Record<string, number> = {};
    workouts.forEach(w => { workoutStartMap[w.uuid] = w.startedAt || 0; });

    // Accumulate volume per week per muscle group
    const weeklyMuscles: Record<string, Record<string, number>> = {};

    sets.forEach(set => {
        const workoutId = weToWorkoutId[set.workoutExerciseId];
        const exerciseId = weToExerciseId[set.workoutExerciseId];
        if (!workoutId || !exerciseId) return;

        const startedAt = workoutStartMap[workoutId];
        if (!startedAt) return;

        const exercise = exerciseMap[exerciseId];
        if (!exercise) return;

        const muscleGroup = exercise.muscleGroup;
        const volume = set.weight * set.reps;

        // Get the Monday of the week
        const date = new Date(startedAt);
        const monday = new Date(date);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;

        if (!weeklyMuscles[weekKey]) weeklyMuscles[weekKey] = {};
        weeklyMuscles[weekKey][muscleGroup] = (weeklyMuscles[weekKey][muscleGroup] || 0) + volume;
    });

    // Convert to sorted array
    return Object.entries(weeklyMuscles)
        .map(([week, muscles]) => ({ week, muscles }))
        .sort((a, b) => {
            const [yA, mA, dA] = a.week.split('-').map(Number);
            const [yB, mB, dB] = b.week.split('-').map(Number);
            return new Date(yA, mA, dA).getTime() - new Date(yB, mB, dB).getTime();
        });
};

// Helper function to calculate PRs (personal records)
const calculatePRs = (sets: SetEntry[], workoutExercises: WorkoutExercise[]) => {
    // Group sets by exercise
    const exerciseSets: Record<string, SetEntry[]> = {};
    sets.forEach(set => {
        const workoutExercise = workoutExercises.find(we => we.uuid === set.workoutExerciseId);
        if (workoutExercise) {
            const exerciseId = workoutExercise.exerciseId;
            if (!exerciseSets[exerciseId]) {
                exerciseSets[exerciseId] = [];
            }
            exerciseSets[exerciseId].push(set);
        }
    });

    // Count PRs (heaviest lift for each exercise)
    let prCount = 0;

    Object.entries(exerciseSets).forEach(([, exerciseSets]) => {
        if (exerciseSets.length > 0) {
            // The first set is the PR for this exercise (we just count one PR per exercise)
            prCount++;
        }
    });

    return prCount;
};

// Simple Bar Chart Component
const BarChart: React.FC<{ data: { week: string; count: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const maxValue = Math.max(...data.map(item => item.count), 1);
    const barWidth = 30;
    const barSpacing = 10;
    const chartHeight = 160;

    return (
        <div className="overflow-x-auto py-2">
            <svg width={data.length * (barWidth + barSpacing)} height={chartHeight} className="min-w-full">
                {data.map((item, index) => {
                    const barHeight = (item.count / maxValue) * (chartHeight - 40);
                    const x = index * (barWidth + barSpacing) + barSpacing;
                    const y = chartHeight - barHeight - 20;

                    return (
                        <g key={index}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                className="fill-primary"
                                rx="4"
                            />
                            <text
                                x={x + barWidth / 2}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                W{index + 1}
                            </text>
                            {item.count > 0 && (
                                <text
                                    x={x + barWidth / 2}
                                    y={y - 5}
                                    textAnchor="middle"
                                    className="text-xs font-bold fill-text-primary"
                                >
                                    {item.count}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// Simple Line Chart Component
const LineChart: React.FC<{ data: { week: string; tonnage: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const maxValue = Math.max(...data.map(item => item.tonnage), 1);
    const pointSpacing = 40;
    const chartHeight = 160;
    const chartWidth = Math.max(data.length * pointSpacing, 200);

    // Create points for the line
    const points = data.map((item, index) => {
        const x = index * pointSpacing + 20;
        const y = chartHeight - 20 - (item.tonnage / maxValue) * (chartHeight - 40);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="overflow-x-auto py-2">
            <svg width={chartWidth} height={chartHeight} className="min-w-full">
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                />

                {/* Points */}
                {data.map((item, index) => {
                    const cx = index * pointSpacing + 20;
                    const cy = chartHeight - 20 - (item.tonnage / maxValue) * (chartHeight - 40);

                    return (
                        <g key={index}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r="4"
                                className="fill-primary"
                            />
                            <text
                                x={cx}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                W{index + 1}
                            </text>
                            <text
                                x={cx}
                                y={cy - 10}
                                textAnchor="middle"
                                className="text-xs font-bold fill-text-primary"
                            >
                                {formatNumber(item.tonnage)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// Simple Weight Line Chart Component
const WeightLineChart: React.FC<{ data: { week: string; weight: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No body weight data available
            </div>
        );
    }

    // Give a bit of margin for min/max
    const minWeight = Math.max(Math.min(...data.map(item => item.weight)) - 5, 0);
    const maxWeight = Math.max(...data.map(item => item.weight)) + 5;
    const range = Math.max(maxWeight - minWeight, 1);

    const pointSpacing = 40;
    const chartHeight = 160;
    const chartWidth = Math.max(data.length * pointSpacing, 200);

    // Create points for the line
    const points = data.map((item, index) => {
        const x = index * pointSpacing + 20;
        const y = chartHeight - 20 - ((item.weight - minWeight) / range) * (chartHeight - 40);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="overflow-x-auto py-2">
            <svg width={chartWidth} height={chartHeight} className="min-w-full">
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                />

                {/* Points */}
                {data.map((item, index) => {
                    const cx = index * pointSpacing + 20;
                    const cy = chartHeight - 20 - ((item.weight - minWeight) / range) * (chartHeight - 40);

                    return (
                        <g key={index}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r="4"
                                className="fill-success"
                            />
                            <text
                                x={cx}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                {item.week}
                            </text>
                            <text
                                x={cx}
                                y={cy - 10}
                                textAnchor="middle"
                                className="text-xs font-bold fill-text-primary"
                            >
                                {item.weight.toFixed(1)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// Stacked Area Chart Component for muscle distribution over time
const MUSCLE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#14b8a6', '#a855f7', '#fb7185'
];

const StackedAreaChart: React.FC<{ data: MuscleWeekData[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    // Collect all unique muscle groups across all weeks
    const muscleSet = new Set<string>();
    data.forEach(d => Object.keys(d.muscles).forEach(m => muscleSet.add(m)));
    const muscleGroups = Array.from(muscleSet);

    // Chart dimensions
    const pointSpacing = 50;
    const chartHeight = 180;
    const chartWidth = Math.max(data.length * pointSpacing + 40, 200);
    const plotHeight = chartHeight - 40;
    const plotBottom = chartHeight - 20;

    // Calculate stacked totals per week to find max
    const weekTotals = data.map(d =>
        muscleGroups.reduce((sum, mg) => sum + (d.muscles[mg] || 0), 0)
    );
    const maxValue = Math.max(...weekTotals, 1);

    // Build stacked areas bottom-up
    const areas = muscleGroups.map((mg, mgIndex) => {
        // For each week, compute the cumulative baseline (sum of previous groups) and the top
        const bottomPoints: string[] = [];
        const topPoints: string[] = [];

        data.forEach((d, i) => {
            const x = i * pointSpacing + 20;
            let baseline = 0;
            for (let j = 0; j < mgIndex; j++) {
                baseline += d.muscles[muscleGroups[j]] || 0;
            }
            const top = baseline + (d.muscles[mg] || 0);

            const yBottom = plotBottom - (baseline / maxValue) * plotHeight;
            const yTop = plotBottom - (top / maxValue) * plotHeight;

            bottomPoints.push(`${x},${yBottom}`);
            topPoints.push(`${x},${yTop}`);
        });

        // Build polygon: top points left-to-right, then bottom points right-to-left
        const polygonPoints = [...topPoints, ...bottomPoints.reverse()].join(' ');
        return (
            <polygon
                key={mg}
                points={polygonPoints}
                fill={MUSCLE_COLORS[mgIndex % MUSCLE_COLORS.length]}
                opacity={0.7}
                stroke={MUSCLE_COLORS[mgIndex % MUSCLE_COLORS.length]}
                strokeWidth="1"
            />
        );
    });

    return (
        <div>
            <div className="overflow-x-auto py-2">
                <svg width={chartWidth} height={chartHeight} className="min-w-full">
                    {areas}
                    {/* Week labels */}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        return (
                            <text
                                key={index}
                                x={x}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                W{index + 1}
                            </text>
                        );
                    })}
                    {/* Total labels on top */}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        const yTop = plotBottom - (weekTotals[index] / maxValue) * plotHeight;
                        return (
                            <text
                                key={`label-${index}`}
                                x={x}
                                y={yTop - 6}
                                textAnchor="middle"
                                className="text-xs font-bold fill-text-primary"
                            >
                                {formatNumber(weekTotals[index])}
                            </text>
                        );
                    })}
                </svg>
            </div>
            {/* Legend */}
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {muscleGroups.map((mg, i) => (
                    <div key={mg} className="flex items-center gap-1.5">
                        <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }}
                        />
                        <span className="text-xs text-text-secondary capitalize">{mg.replace(/_/g, ' ')}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Multi-Line Chart Component for muscle volume trends (analogous to Tonnage over Time)
const MultiLineChart: React.FC<{ data: MuscleWeekData[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    // Collect all muscle groups
    const muscleSet = new Set<string>();
    data.forEach(d => Object.keys(d.muscles).forEach(m => muscleSet.add(m)));
    const muscleGroups = Array.from(muscleSet);

    // Chart dimensions
    const pointSpacing = 50;
    const chartHeight = 200;
    const chartWidth = Math.max(data.length * pointSpacing + 40, 200);
    const plotHeight = chartHeight - 40;
    const plotBottom = chartHeight - 20;

    // Find global max volume for scaling
    let maxVolume = 0;
    data.forEach(d => {
        Object.values(d.muscles).forEach(v => {
            if (v > maxVolume) maxVolume = v;
        });
    });
    maxVolume = Math.max(maxVolume, 1);

    return (
        <div>
            <div className="overflow-x-auto py-2">
                <svg width={chartWidth} height={chartHeight} className="min-w-full">
                    {/* Lines for each muscle group */}
                    {muscleGroups.map((mg, i) => {
                        const points = data.map((d, index) => {
                            const x = index * pointSpacing + 20;
                            const volume = d.muscles[mg] || 0;
                            const y = plotBottom - (volume / maxVolume) * plotHeight;
                            return `${x},${y}`;
                        }).join(' ');

                        const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];

                        return (
                            <g key={mg}>
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="2"
                                    opacity={0.8}
                                />
                                {/* Data points */}
                                {data.map((d, index) => {
                                    const volume = d.muscles[mg] || 0;
                                    if (volume === 0) return null;

                                    const x = index * pointSpacing + 20;
                                    const y = plotBottom - (volume / maxVolume) * plotHeight;

                                    return (
                                        <circle
                                            key={`${mg}-${index}`}
                                            cx={x}
                                            cy={y}
                                            r="3"
                                            fill={color}
                                        />
                                    );
                                })}
                            </g>
                        );
                    })}

                    {/* Week labels */}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        return (
                            <text
                                key={index}
                                x={x}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                W{index + 1}
                            </text>
                        );
                    })}
                </svg>
            </div>

            {/* Legend */}
            {/* Legend */}
            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {muscleGroups.map((mg, i) => {
                    const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
                    return (
                        <div key={mg} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full shadow-sm border border-black/10 flex-shrink-0"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-medium text-text-primary capitalize whitespace-nowrap">
                                {mg.replace(/_/g, ' ')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>


    );
};

// Simple Pie Chart Component
const PieChart: React.FC<{ data: { name: string; volume: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.volume, 0);
    if (total === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const centerX = 80;
    const centerY = 80;
    const radius = 60;
    let startAngle = 0;

    // Colors for different muscle groups
    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];

    return (
        <div className="flex justify-center py-2">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {data.slice(0, 8).map((item, index) => {
                    const slicePercentage = item.volume / total;
                    const sliceAngle = slicePercentage * 360;
                    const endAngle = startAngle + sliceAngle;

                    // Convert angles to radians
                    const startAngleRad = (startAngle - 90) * Math.PI / 180;
                    const endAngleRad = (endAngle - 90) * Math.PI / 180;

                    // Calculate coordinates
                    const x1 = centerX + radius * Math.cos(startAngleRad);
                    const y1 = centerY + radius * Math.sin(startAngleRad);
                    const x2 = centerX + radius * Math.cos(endAngleRad);
                    const y2 = centerY + radius * Math.sin(endAngleRad);

                    // Large arc flag
                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

                    // Create path
                    const pathData = `
                        M ${centerX} ${centerY}
                        L ${x1} ${y1}
                        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
                        Z
                    `;

                    const color = colors[index % colors.length];
                    startAngle = endAngle;

                    return (
                        <path
                            key={index}
                            d={pathData}
                            fill={color}
                            stroke="#fff"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Center circle */}
                <circle cx={centerX} cy={centerY} r="20" fill="#fff" />

                {/* Total volume in center */}
                <text
                    x={centerX}
                    y={centerY - 5}
                    textAnchor="middle"
                    className="text-xs font-bold fill-text-primary"
                >
                    {formatNumber(total)}
                </text>
                <text
                    x={centerX}
                    y={centerY + 10}
                    textAnchor="middle"
                    className="text-xs fill-text-secondary"
                >
                    Total
                </text>
            </svg>
        </div>
    );
};

export const StatsPage: React.FC = () => {
    // Period filter state
    const [period, setPeriod] = useState<'week' | 'month' | '3months' | '6months' | 'year' | 'all'>('3months');

    // Stats calculation
    const stats = useLiveQuery<Stats | null>(async () => {
        const workouts = await db.workouts.toArray();
        const exercises = await db.exercises.toArray();

        const completedWorkouts = workouts.filter(w => !!w.endedAt);

        // Filter by period
        const filteredWorkouts = filterWorkoutsByPeriod(completedWorkouts, period);

        // Get sets for filtered workouts
        const workoutIds = filteredWorkouts.map(w => w.uuid);
        const workoutExercises = await db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray();
        const workoutExerciseIds = workoutExercises.map(we => we.uuid);
        const filteredSets = await db.sets.where('workoutExerciseId').anyOf(workoutExerciseIds).toArray();

        // Calculate metrics
        const totalWorkouts = filteredWorkouts.length;
        const totalSets = filteredSets.length;
        const totalReps = filteredSets.reduce((acc, s) => acc + s.reps, 0);

        // Tonnage calculation (effective load)
        const totalTonnage = filteredSets.reduce((acc, s) => acc + (s.weight * s.reps), 0);

        // Average workouts per week
        const avgWorkoutsPerWeek = calculateAvgWorkoutsPerWeek(filteredWorkouts, period);

        // This Week
        const toDayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        const startDay = toDayString(start);

        const thisWeekWorkouts = completedWorkouts.filter(w => w.workoutDay >= startDay);

        // Muscle group distribution
        const muscleDistribution = calculateMuscleDistribution(filteredSets, workoutExercises, exercises);

        // Workouts over time (weekly)
        const workoutsOverTime = calculateWorkoutsOverTime(filteredWorkouts);

        // Tonnage over time (weekly)
        const tonnageOverTime = calculateTonnageOverTime(filteredSets, workoutExercises, filteredWorkouts);

        // Muscle distribution over time (weekly by muscle group)
        const muscleDistributionOverTime = calculateMuscleDistributionOverTime(filteredSets, workoutExercises, filteredWorkouts, exercises);

        // PR counter
        const prCount = calculatePRs(filteredSets, workoutExercises);

        // Body weight over time
        const bodyWeightOverTime = calculateBodyWeightOverTime(filteredWorkouts);

        return {
            totalWorkouts,
            totalTonnage,
            totalSets,
            totalReps,
            avgWorkoutsPerWeek,
            thisWeekCount: thisWeekWorkouts.length,
            muscleDistribution,
            workoutsOverTime,
            tonnageOverTime,
            muscleDistributionOverTime,
            prCount,
            bodyWeightOverTime
        };
    }, [period]);

    return (
        <div className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold">Statistics</h1>

            {/* Period Filter */}
            <div className="flex overflow-x-auto gap-2 pb-2">
                {(['week', 'month', '3months', '6months', 'year', 'all'] as const).map((p) => (
                    <button
                        key={p}
                        className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${period === p ? 'bg-primary text-white' : 'bg-mid text-text-secondary'}`}
                        onClick={() => setPeriod(p)}
                    >
                        {p === 'week' && 'Week'}
                        {p === 'month' && 'Month'}
                        {p === '3months' && '3 Months'}
                        {p === '6months' && '6 Months'}
                        {p === 'year' && 'Year'}
                        {p === 'all' && 'All'}
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

            {/* Workouts Over Time Chart */}
            <Card>
                <h2 className="font-bold mb-4">Workouts Over Time</h2>
                <BarChart data={stats?.workoutsOverTime || []} />
            </Card>

            {/* Body Weight Over Time Chart */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-success" size={20} />
                    <h2 className="font-bold">Body Weight Over Time (kg)</h2>
                </div>
                <WeightLineChart data={stats?.bodyWeightOverTime || []} />
            </Card>

            {/* Tonnage Over Time Chart */}
            <Card>
                <h2 className="font-bold mb-4">Tonnage Over Time</h2>
                <LineChart data={stats?.tonnageOverTime || []} />
            </Card>

            {/* Muscle Distribution Over Time Chart */}
            <Card>
                <h2 className="font-bold mb-4">Muscle Distribution Over Time (Stacked)</h2>
                <StackedAreaChart data={stats?.muscleDistributionOverTime || []} />
            </Card>

            {/* Muscle Volume Trends Chart */}
            <Card>
                <h2 className="font-bold mb-4">Muscle Volume Trends</h2>
                <MultiLineChart data={stats?.muscleDistributionOverTime || []} />
            </Card>

            {/* Muscle Distribution Chart */}
            <Card>
                <h2 className="font-bold mb-4">Muscle Distribution</h2>
                <PieChart data={stats?.muscleDistribution.map(item => ({ name: item.name, volume: item.volume })) || []} />

                {/* Muscle Group Details */}
                <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                    {stats?.muscleDistribution.slice(0, 6).map((item, index) => (
                        <div key={index} className="border border-border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 6] }}
                                ></div>
                                <span className="font-medium capitalize">{item.name}</span>
                                <span className="text-sm text-text-secondary ml-auto">{formatNumber(item.volume)}</span>
                            </div>

                            {/* Top Exercises */}
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