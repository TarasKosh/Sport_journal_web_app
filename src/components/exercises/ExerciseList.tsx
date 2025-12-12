import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Exercise } from '../../types';

import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Plus, Search, Tag } from 'lucide-react';
import { EditExerciseModal } from './EditExerciseModal';
import { ExerciseDetails } from './ExerciseDetails';

export const ExerciseList: React.FC = () => {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | undefined>(undefined);
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

    const exercises = useLiveQuery(async () => {
        // If we had many exercises, we'd use a more complex query or offset/limit
        // For now, simple client-side filter after fetch or basic startsWith
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

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Header */}
            <div className="p-4 border-b border-border sticky top-0 bg-bg-primary z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Exercises</h1>
                    <Button size="sm" onClick={handleCreate}>
                        <Plus size={18} className="mr-1" /> New
                    </Button>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!exercises && <div className="text-center text-text-secondary mt-8">Loading...</div>}
                {exercises?.length === 0 && (
                    <div className="text-center text-text-secondary mt-8">
                        No exercises found. <br />
                        <Button variant="ghost" className="mt-2 text-accent" onClick={handleCreate}>Create one?</Button>
                    </div>
                )}

                {exercises?.map(ex => (
                    <Card key={ex.uuid} onClick={() => setSelectedExercise(ex)} className="cursor-pointer hover:bg-bg-tertiary flex justify-between items-center group">
                        <div>
                            <h3 className="font-medium text-lg">{ex.name}</h3>
                            <div className="flex items-center text-xs text-text-secondary mt-1 gap-2">
                                <span className="capitalize flex items-center gap-1">
                                    <Tag size={12} /> {ex.muscleGroup}
                                </span>
                                {ex.equipment && <span className="capitalize">• {ex.equipment}</span>}
                            </div>
                        </div>
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
        </div>
    );
};
