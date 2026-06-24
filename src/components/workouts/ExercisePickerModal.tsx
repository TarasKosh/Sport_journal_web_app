import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Search, Plus, Dumbbell, X } from 'lucide-react';
import type { MuscleGroup } from '../../types';
import { ModalShell } from '../common/ModalShell';

interface ExercisePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (exerciseId: string) => void;
}

const muscleGroupIcons: Record<MuscleGroup, string> = {
    chest: '💪',
    back: '🦾',
    shoulders: '🏋️',
    legs: '🦵',
    arms: '💪',
    core: '🎯',
    full_body: '🔥',
    cardio: '❤️',
    other: '⚡'
};

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [search, setSearch] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | 'all'>('all');

    const exercises = useLiveQuery(async () => {
        const all = await db.exercises.orderBy('name').toArray();
        let filtered = all;
        
        if (search) {
            const lower = search.toLowerCase();
            filtered = filtered.filter(e => 
                e.name.toLowerCase().includes(lower) || 
                e.muscleGroup.includes(lower)
            );
        }
        
        if (selectedMuscleGroup !== 'all') {
            filtered = filtered.filter(e => e.muscleGroup === selectedMuscleGroup);
        }
        
        return filtered;
    }, [search, selectedMuscleGroup]);

    const muscleGroups = useLiveQuery(async () => {
        const all = await db.exercises.toArray();
        const groups = new Set(all.map(e => e.muscleGroup));
        return Array.from(groups).sort();
    });

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Add Exercise"
            titleId="exercise-picker-title"
            header={(
                <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex-shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h2 id="exercise-picker-title" className="text-2xl font-bold">Add Exercise</h2>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            aria-label="Close exercise picker"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search exercises..."
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-lg font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Search exercises"
                        />
                    </div>
                </div>
            )}
        >
            {/* Muscle Group Filter */}
            <div className="px-4 py-3 border-b border-border bg-bg-secondary overflow-x-auto" aria-label="Filter by muscle group">
                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedMuscleGroup('all')}
                        aria-pressed={selectedMuscleGroup === 'all'}
                        className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                            selectedMuscleGroup === 'all'
                                ? 'bg-accent text-white shadow-md'
                                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
                        }`}
                    >
                        All
                    </button>
                    {muscleGroups?.map(group => (
                        <button
                            key={group}
                            onClick={() => setSelectedMuscleGroup(group)}
                            aria-pressed={selectedMuscleGroup === group}
                            className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                                selectedMuscleGroup === group
                                    ? 'bg-accent text-white shadow-md'
                                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
                            }`}
                        >
                            <span className="mr-1.5" aria-hidden="true">{muscleGroupIcons[group as MuscleGroup]}</span>
                            {group.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
                {exercises?.length === 0 ? (
                    <div className="text-center py-16">
                        <Dumbbell size={48} className="text-text-tertiary mx-auto mb-4" aria-hidden="true" />
                        <p className="text-text-secondary text-lg">No exercises found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {exercises?.map(ex => (
                            <button
                                key={ex.uuid}
                                className="w-full text-left p-5 bg-bg-secondary hover:bg-accent/5 border-2 border-border hover:border-accent/30 rounded-2xl transition-all active:scale-[0.97] flex justify-between items-center group shadow-sm hover:shadow-md"
                                onClick={() => onSelect(ex.uuid)}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-2xl flex-shrink-0" aria-hidden="true">
                                        {muscleGroupIcons[ex.muscleGroup]}
                                    </div>
                                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                        <span className="font-bold text-lg text-text-primary truncate">{ex.name}</span>
                                        <div className="flex gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider bg-bg-tertiary px-2.5 py-1 rounded-lg">
                                                {ex.muscleGroup.replace('_', ' ')}
                                            </span>
                                            {ex.isUnilateral && (
                                                <span className="text-xs font-semibold text-accent uppercase tracking-wider bg-accent/10 px-2.5 py-1 rounded-lg">
                                                    Unilateral
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0" aria-hidden="true">
                                    <Plus size={24} strokeWidth={3} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </ModalShell>
    );
};
