import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Input } from '../common/Input';
import { X, Search, Plus } from 'lucide-react';

interface ExercisePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (exerciseId: string) => void;
}

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [search, setSearch] = useState('');

    const exercises = useLiveQuery(async () => {
        const all = await db.exercises.orderBy('name').toArray();
        if (!search) return all;
        const lower = search.toLowerCase();
        return all.filter(e => e.name.toLowerCase().includes(lower) || e.muscleGroup.includes(lower));
    }, [search]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-bg-secondary w-full max-w-md h-80vh flex flex-col rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-lg font-bold">Add Exercise</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>

                <div className="p-4 border-b border-border">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <Input
                            placeholder="Search..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {exercises?.map(ex => (
                        <button
                            key={ex.uuid}
                            className="w-full text-left p-4 mb-2 bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-xl transition-all active:scale-[0.98] flex justify-between items-center group"
                            onClick={() => onSelect(ex.uuid)}
                        >
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-lg text-text-primary">{ex.name}</span>
                                <div className="flex gap-2">
                                    <span className="text-xs text-text-secondary uppercase tracking-wider bg-bg-primary px-2 py-1 rounded-md">{ex.muscleGroup}</span>
                                    {ex.isUnilateral && (
                                        <span className="text-xs text-accent/80 uppercase tracking-wider bg-accent/10 px-2 py-1 rounded-md">Unilateral</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={20} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
