import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { EditExerciseModal } from './EditExerciseModal';
import { safeNum, kgToDisplay, massUnitLabel } from '../../utils';
import { useSettings } from '../../hooks/useSettings';
import { ExerciseRepository } from '../../data/repositories/ExerciseRepository';
import { SetRepository } from '../../data/repositories/SetRepository';
import { ArrowLeft, Edit2 } from 'lucide-react';

/** How many recent sets feed the progress chart / history list. */
const RECENT_SET_LIMIT = 20;

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
    const settings = useSettings();
    const unitLabel = massUnitLabel(settings.massUnit).toLowerCase();

    // Keep the header/modal in sync with the stored row after an edit.
    const currentExercise = useLiveQuery(
        () => ExerciseRepository.getByUuid(exercise.uuid),
        [exercise.uuid],
    ) ?? exercise;

    /**
     * Recent performance only. This used to load every workout plus one join query per
     * workout and then filter in JS; the denormalized `exerciseId` index answers it with a
     * single bounded range scan.
     */
    const history = useLiveQuery(
        () => SetRepository.recentByExercise(exercise.uuid, RECENT_SET_LIMIT),
        [exercise.uuid],
    );

    // Calculate Epley 1RM in kg, then convert for display
    const epley = (w: number, r: number) => w * (1 + r / 30);

    const oneRMData = history?.map(s => {
        const w = safeNum(s.weight);
        const r = safeNum(s.reps);
        return kgToDisplay(epley(w, r), settings.massUnit);
    }).filter(v => !isNaN(v) && isFinite(v)) || [];

    return (
        <div className="flex flex-col h-full overflow-y-auto p-4 bg-bg-primary">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                <h1 className="text-xl font-bold flex-1">{currentExercise.name}</h1>
                <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)}><Edit2 size={18} /></Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <h2 className="font-bold mb-2">Progress</h2>
                    {history && history.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            <SimpleLineChart data={oneRMData.slice(-20)} label={`Est. 1RM (${unitLabel}, Last 20 Sets)`} />
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
                                <span>{new Date(s.performedAt ?? 0).toLocaleDateString()}</span>
                                <span className="font-mono">
                                    {kgToDisplay(safeNum(s.weight), settings.massUnit)} {unitLabel} x {s.reps}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {isEditOpen && (
                <EditExerciseModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    exercise={currentExercise}
                />
            )}
        </div>
    );
};
