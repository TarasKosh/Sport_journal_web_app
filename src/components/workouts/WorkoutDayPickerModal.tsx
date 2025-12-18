import React from 'react';
import { Calendar, X } from 'lucide-react';

import { Button } from '../common/Button';

export interface WorkoutDayPickerModalProps {
    isOpen: boolean;
    value: string;
    onClose: () => void;
    onChange: (val: string) => void;
    onApply: () => void;
    onToday: () => void;
}

export const WorkoutDayPickerModal: React.FC<WorkoutDayPickerModalProps> = ({
    isOpen,
    value,
    onClose,
    onChange,
    onApply,
    onToday
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-bg-primary w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} />
                            <h2 className="text-2xl font-bold">Workout Day</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none"
                    />
                    <div className="flex gap-2">
                        <Button variant="secondary" fullWidth onClick={onToday}>
                            Today
                        </Button>
                        <Button fullWidth onClick={onApply}>
                            Apply
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
