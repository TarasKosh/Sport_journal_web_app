import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { X, Dumbbell, Plus } from 'lucide-react';

interface TemplatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (templateId: string) => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const templates = useLiveQuery(() => db.workoutTemplates.toArray());

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-bg-primary w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                {/* Header */}
                <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Workout Templates</h2>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Template List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {templates?.length === 0 ? (
                        <div className="text-center py-16">
                            <Dumbbell size={48} className="text-text-tertiary mx-auto mb-4" />
                            <p className="text-text-secondary text-lg">No templates yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {templates?.map(template => (
                                <button
                                    key={template.uuid}
                                    className="w-full text-left p-5 bg-bg-secondary hover:bg-accent/5 border-2 border-border hover:border-accent/30 rounded-2xl transition-all active:scale-[0.97] flex justify-between items-center group shadow-sm hover:shadow-md"
                                    onClick={() => onSelect(template.uuid)}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-2xl flex-shrink-0">
                                            💪
                                        </div>
                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                            <span className="font-bold text-lg text-text-primary truncate">{template.name}</span>
                                            {template.description && (
                                                <span className="text-sm text-text-secondary">{template.description}</span>
                                            )}
                                            <span className="text-xs text-text-tertiary">
                                                {template.exercises.length} exercises
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                                        <Plus size={24} strokeWidth={3} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
