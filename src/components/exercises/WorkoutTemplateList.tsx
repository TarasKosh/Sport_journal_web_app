import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, Edit2, Dumbbell } from 'lucide-react';

import { db } from '../../db/db';
import type { WorkoutTemplate } from '../../types';

import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { EditWorkoutTemplateModal } from './EditWorkoutTemplateModal';

export const WorkoutTemplateList: React.FC = () => {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | undefined>(undefined);

    const templates = useLiveQuery(async () => {
        const all = await db.workoutTemplates.orderBy('name').toArray();
        return all;
    }, []);

    const filtered = useMemo(() => {
        if (!templates) return undefined;
        if (!search) return templates;
        const lower = search.toLowerCase();
        return templates.filter(t => t.name.toLowerCase().includes(lower) || (t.description || '').toLowerCase().includes(lower));
    }, [templates, search]);

    const handleCreate = () => {
        setEditingTemplate(undefined);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            <div className="p-4 border-b border-border sticky top-0 bg-bg-primary z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Templates</h1>
                </div>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <Input
                        placeholder="Search templates..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!filtered && <div className="text-center text-text-secondary mt-8">Loading...</div>}
                {filtered?.length === 0 && (
                    <div className="text-center text-text-secondary mt-8">
                        No templates found. <br />
                        <Button variant="ghost" className="mt-2 text-accent" onClick={handleCreate}>Create one?</Button>
                    </div>
                )}

                {filtered?.map(t => (
                    <Card key={t.uuid} className="flex items-center gap-2 group hover:bg-bg-tertiary transition-colors">
                        <div className="flex-1 py-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-lg">{t.name}</h3>
                                {!t.isCustom && (
                                    <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider bg-bg-tertiary px-2 py-0.5 rounded-lg">Default</span>
                                )}
                            </div>
                            {t.description && <div className="text-sm text-text-secondary mt-1">{t.description}</div>}
                            <div className="flex items-center gap-2 text-xs text-text-tertiary mt-1">
                                <span className="flex items-center gap-1"><Dumbbell size={12} /> {t.exercises.length} exercises</span>
                            </div>
                        </div>

                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                setEditingTemplate(t);
                                setIsModalOpen(true);
                            }}
                            className="text-text-tertiary hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-bg-secondary"
                            title="Edit template"
                        >
                            <Edit2 size={20} />
                        </button>

                        {t.isCustom && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete \"${t.name}\"? This cannot be undone.`)) {
                                        await db.workoutTemplates.delete(t.id!);
                                    }
                                }}
                                className="text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-danger/10"
                                title="Delete template"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                    </Card>
                ))}
            </div>

            {isModalOpen && (
                <EditWorkoutTemplateModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    template={editingTemplate}
                />
            )}

            <button
                onClick={handleCreate}
                className="fixed bg-accent text-white shadow-xl rounded-full px-5 py-3 font-bold flex items-center gap-2 active:scale-[0.98]"
                style={{ right: '1rem', bottom: '8.5rem', zIndex: 60 }}
                title="New template"
            >
                <Plus size={20} />
                <span>New</span>
            </button>
        </div>
    );
};
