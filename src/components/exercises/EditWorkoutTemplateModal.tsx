import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { X, ArrowUp, ArrowDown, Trash2, Search, Plus } from 'lucide-react';

import { db } from '../../db/db';
import type { Exercise, WorkoutTemplate } from '../../types';

interface EditWorkoutTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    template?: WorkoutTemplate;
}

export const EditWorkoutTemplateModal: React.FC<EditWorkoutTemplateModalProps> = ({ isOpen, onClose, template }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
    const [search, setSearch] = useState('');

    const exercises = useLiveQuery(async () => {
        const all = await db.exercises.orderBy('name').toArray();
        if (!search) return all;
        const lower = search.toLowerCase();
        return all.filter(e => e.name.toLowerCase().includes(lower) || e.muscleGroup.includes(lower));
    }, [search]);

    const exerciseMap = useMemo(() => {
        const map = new Map<string, Exercise>();
        for (const ex of exercises || []) map.set(ex.uuid, ex);
        return map;
    }, [exercises]);

    useEffect(() => {
        if (template) {
            setName(prev => prev !== template.name ? template.name : prev);
            setDescription(prev => prev !== (template.description || '') ? (template.description || '') : prev);
            setSelectedExerciseIds(prev => {
                const next = template.exercises || [];
                if (prev.length !== next.length || prev.some((v, i) => v !== next[i])) return next;
                return prev;
            });
        } else {
            setName('');
            setDescription('');
            setSelectedExerciseIds([]);
        }
    }, [template]);

    const handleAddExercise = (id: string) => {
        setSelectedExerciseIds(prev => [...prev, id]);
    };

    const handleRemoveSelected = (index: number) => {
        setSelectedExerciseIds(prev => prev.filter((_, i) => i !== index));
    };

    const moveSelected = (index: number, dir: 'up' | 'down') => {
        setSelectedExerciseIds(prev => {
            const next = [...prev];
            const newIndex = dir === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= next.length) return prev;
            const tmp = next[index];
            next[index] = next[newIndex];
            next[newIndex] = tmp;
            return next;
        });
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        if (selectedExerciseIds.length === 0) return;

        try {
            const now = Date.now();
            if (template && template.id) {
                await db.workoutTemplates.update(template.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    exercises: selectedExerciseIds,
                    isCustom: true,
                    updatedAt: now
                });
            } else {
                await db.workoutTemplates.add({
                    uuid: uuidv4(),
                    name: name.trim(),
                    description: description.trim() || undefined,
                    exercises: selectedExerciseIds,
                    isCustom: true,
                    updatedAt: now
                } as WorkoutTemplate);
            }
            onClose();
        } catch (e) {
            console.error('Failed to save template', e);
            alert('Error saving template');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            style={{ zIndex: 70 }}
        >
            <div className="bg-bg-secondary w-full max-w-3xl rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-lg font-bold">{template ? 'Edit Template' : 'New Template'}</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-sm text-text-secondary font-medium">Name</label>
                            <input
                                className="w-full bg-bg-tertiary border border-transparent rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Push Day"
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-sm text-text-secondary font-medium">Description</label>
                            <input
                                className="w-full bg-bg-tertiary border border-transparent rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="border border-border rounded-lg bg-bg-primary">
                            <div className="p-3 border-b border-border flex items-center justify-between">
                                <span className="font-bold">Selected Exercises</span>
                                <span className="text-xs text-text-tertiary">{selectedExerciseIds.length}</span>
                            </div>
                            <div className="p-3 space-y-2">
                                {selectedExerciseIds.length === 0 && (
                                    <div className="text-sm text-text-secondary">Add at least one exercise.</div>
                                )}

                                {selectedExerciseIds.map((id, index) => {
                                    const ex = exerciseMap.get(id);
                                    return (
                                        <div key={`${id}-${index}`} className="flex items-center gap-2 bg-bg-tertiary rounded-lg px-3 py-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{ex ? ex.name : id}</div>
                                                {ex && <div className="text-xs text-text-tertiary capitalize">{ex.muscleGroup.replace('_', ' ')}</div>}
                                            </div>

                                            <button
                                                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary"
                                                onClick={() => moveSelected(index, 'up')}
                                                disabled={index === 0}
                                                title="Move up"
                                            >
                                                <ArrowUp size={16} />
                                            </button>
                                            <button
                                                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary"
                                                onClick={() => moveSelected(index, 'down')}
                                                disabled={index === selectedExerciseIds.length - 1}
                                                title="Move down"
                                            >
                                                <ArrowDown size={16} />
                                            </button>
                                            <button
                                                className="p-2 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger"
                                                onClick={() => handleRemoveSelected(index)}
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="border border-border rounded-lg bg-bg-primary flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-border">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    className="w-full bg-bg-tertiary border border-transparent rounded-md pl-9 pr-3 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search exercises..."
                                />
                            </div>
                        </div>

                        <div className="p-3 overflow-y-auto flex-1 space-y-2">
                            {exercises?.map(ex => (
                                <button
                                    key={ex.uuid}
                                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 transition-colors"
                                    onClick={() => handleAddExercise(ex.uuid)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{ex.name}</div>
                                        <div className="text-xs text-text-tertiary capitalize">{ex.muscleGroup.replace('_', ' ')}</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-accent text-white">
                                        <Plus size={16} />
                                    </div>
                                </button>
                            ))}
                            {exercises?.length === 0 && (
                                <div className="text-sm text-text-secondary">No exercises found</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3">
                    <button className="btn bg-transparent hover:bg-bg-tertiary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim() || selectedExerciseIds.length === 0}>Save</button>
                </div>
            </div>
        </div>
    );
};
