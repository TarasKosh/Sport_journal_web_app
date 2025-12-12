import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Exercise } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { EditExerciseModal } from './EditExerciseModal';
import { ArrowLeft, Edit2 } from 'lucide-react';

// Simple SVG Chart Component
const SimpleLineChart = ({ data, label }: { data: number[], label: string }) => {
    if (!data.length) return <div className="h-32 flex items-center justify-center text-text-secondary">No Data</div>;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    // SVG points
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1 || 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-text-secondary">{label}</span>
            <div className="relative h-24 border-l border-b border-border">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
                    {data.map((val, i) => (
                        <circle key={i} cx={(i / (data.length - 1 || 1)) * 100} cy={100 - ((val - min) / range) * 100} r="2" fill="var(--color-bg-primary)" stroke="var(--color-accent)" />
                    ))}
                </svg>
            </div>
            <div className="flex justify-between text-xs text-text-tertiary">
                <span>Start</span>
                <span>Current: {data[data.length - 1]}</span>
            </div>
        </div>
    );
};

export const ExerciseDetails: React.FC<{ exercise: Exercise, onBack: () => void }> = ({ exercise, onBack }) => {
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Fetch history for stats
    const history = useLiveQuery(async () => {
        // Find all sets for this exercise
        // Use compound index or join. For MVP, filter sets.
        // Assuming we look up by workoutExercise... complex query.
        // Simplified: Fetch all WorkoutExercises for this exercise, then fetch their sets.
        const wes = await db.workoutExercises.where('exerciseId').equals(exercise.uuid).toArray();
        const weIds = wes.map(we => we.uuid);
        const sets = await db.sets.where('workoutExerciseId').anyOf(weIds).toArray();

        // Sort sets by time? Sets don't have timestamp, Workouts do.
        // Need to join Workout to get date.
        // This is heavy for client-side without refined indexing or denormalization.
        // For 1RM chart, we need Date + Weight + Reps.

        // Let's optimize: map sets to workouts
        // Needs proper 'repository' method. MVP: Just load all workouts.
        const workouts = await db.workouts.toArray();
        const workoutMap = new Map(workouts.map(w => [w.uuid, w.startedAt]));
        const weMap = new Map(wes.map(we => [we.uuid, we.workoutId]));

        return sets.map(s => {
            const wId = weMap.get(s.workoutExerciseId);
            const date = wId ? workoutMap.get(wId) : 0;
            return { ...s, date: date || 0 };
        }).sort((a, b) => a.date - b.date);
    }, [exercise.uuid]);

    // Calculate Epley 1RM
    const epley = (w: number, r: number) => w * (1 + r / 30);

    const oneRMData = history?.map(s => epley(s.weight, s.reps)) || [];
    // Smoothed or per-workout max? Charting every set is noisy.

    // Group by workout (date) and take max 1RM


    return (
        <div className="flex flex-col h-full overflow-y-auto p-4 bg-bg-primary">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                <h1 className="text-xl font-bold flex-1">{exercise.name}</h1>
                <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)}><Edit2 size={18} /></Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <h2 className="font-bold mb-2">Progress</h2>
                    {history && history.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            <SimpleLineChart data={oneRMData.slice(-20)} label="Est. 1RM (Last 20 Sets)" />
                            {/* <SimpleLineChart data={volumeData.slice(-20)} label="Volume" /> */}
                        </div>
                    ) : (
                        <p className="text-text-secondary text-sm">Log this exercise to see progress.</p>
                    )}
                </Card>

                <Card>
                    <h2 className="font-bold mb-2">History</h2>
                    <div className="space-y-2">
                        {history?.slice(-5).reverse().map(s => (
                            <div key={s.uuid} className="flex justify-between text-sm border-b border-border pb-1">
                                <span>{new Date(s.date).toLocaleDateString()}</span>
                                <span className="font-mono">{s.weight}kg x {s.reps}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {isEditOpen && (
                <EditExerciseModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    exercise={exercise}
                />
            )}
        </div>
    );
};
