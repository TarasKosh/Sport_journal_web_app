import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Exercise } from '../../types';

import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Plus, Search, Tag, Trash2 } from 'lucide-react';
import { EditExerciseModal } from './EditExerciseModal';
import { ExerciseDetails } from './ExerciseDetails';
import { WorkoutTemplateList } from './WorkoutTemplateList';

export const ExerciseList: React.FC = () => {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | undefined>(undefined);
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [activeTab, setActiveTab] = useState<'exercises' | 'templates'>('exercises');

    const exercises = useLiveQuery(async () => {
        const all = await db.exercises.orderBy('name').toArray();
        if (!search) return all;
        const lower = search.toLowerCase();
        return all.filter(e => e.name.toLowerCase().includes(lower) || e.muscleGroup.includes(lower));
    }, [search]);

    const handleCreate = () => {
        setEditingExercise(undefined);
        setIsModalOpen(true);
    };

    if (selectedExercise) {
        return <ExerciseDetails exercise={selectedExercise} onBack={() => setSelectedExercise(null)} />;
    }

    if (activeTab === 'templates') {
        return (
            <div className="flex flex-col h-full bg-bg-primary">
                <div className="flex-1 min-h-0 pb-20">
                    <WorkoutTemplateList />
                </div>

                <div
                    className="fixed left-0 right-0 px-4 pb-3"
                    style={{ bottom: '4rem', zIndex: 55 }}
                >
                    <div className="bg-bg-secondary border border-border rounded-2xl p-2 shadow-lg flex gap-2">
                        <button
                            onClick={() => setActiveTab('exercises')}
                            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80"
                        >
                            Exercises
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-accent text-white shadow-md"
                        >
                            Templates
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Header */}
            <div className="p-4 border-b border-border sticky top-0 bg-bg-primary z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Exercises</h1>
                </div>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <Input
                        placeholder="Search exercises..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                {!exercises && <div className="text-center text-text-secondary mt-8">Loading...</div>}
                {exercises?.length === 0 && (
                    <div className="text-center text-text-secondary mt-8">
                        No exercises found. <br />
                        <Button variant="ghost" className="mt-2 text-accent" onClick={handleCreate}>Create one?</Button>
                    </div>
                )}

                {exercises?.map((ex) => (
                    <Card key={ex.uuid} className="flex items-center gap-2 group hover:bg-bg-tertiary transition-colors">
                        {/* Exercise Info */}
                        <div className="flex-1 cursor-pointer py-2" onClick={() => setSelectedExercise(ex)}>
                            <h3 className="font-medium text-lg">{ex.name}</h3>
                            <div className="flex items-center text-xs text-text-secondary mt-1 gap-2">
                                <span className="capitalize flex items-center gap-1">
                                    <Tag size={12} /> {ex.muscleGroup}
                                </span>
                                {ex.equipment && <span className="capitalize">• {ex.equipment}</span>}
                            </div>
                        </div>

                        {/* Delete Button */}
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${ex.name}"? This cannot be undone.`)) {
                                    await db.exercises.delete(ex.id!);
                                }
                            }}
                            className="text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-danger/10"
                            title="Delete exercise"
                        >
                            <Trash2 size={20} />
                        </button>
                    </Card>
                ))}
            </div>

            {isModalOpen && (
                <EditExerciseModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    exercise={editingExercise}
                />
            )}

            <button
                onClick={handleCreate}
                className="fixed bg-accent text-white shadow-xl rounded-full px-5 py-3 font-bold flex items-center gap-2 active:scale-[0.98]"
                style={{ right: '1rem', bottom: '8.5rem', zIndex: 60 }}
                title="New exercise"
            >
                <Plus size={20} />
                <span>New</span>
            </button>

            <div
                className="fixed left-0 right-0 px-4 pb-3"
                style={{ bottom: '4rem', zIndex: 55 }}
            >
                <div className="bg-bg-secondary border border-border rounded-2xl p-2 shadow-lg flex gap-2">
                    <button
                        onClick={() => setActiveTab('exercises')}
                        className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-accent text-white shadow-md"
                    >
                        Exercises
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80"
                    >
                        Templates
                    </button>
                </div>
            </div>
        </div>
    );
};
