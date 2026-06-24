import React from 'react';
import { Calendar, X } from 'lucide-react';

import { Button } from '../common/Button';
import { ModalShell } from '../common/ModalShell';

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
    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Workout Day"
            titleId="workout-day-title"
            maxWidth="sm"
            height="auto"
            header={(
                <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} aria-hidden="true" />
                            <h2 id="workout-day-title" className="text-2xl font-bold">Workout Day</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            aria-label="Close workout day picker"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        >
            <div className="p-4 space-y-4">
                <input
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none"
                    aria-label="Select workout date"
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
        </ModalShell>
    );
};
