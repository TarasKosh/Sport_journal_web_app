import React, { useEffect, useState } from 'react';
import type { SetEntry } from '../../types';
import { db } from '../../db/db';
import { Check, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useDebounce } from '../../hooks/useDebounce'; // We need this hook or inline it

// function useDebounce removed, using import

interface SetItemProps {
    set: SetEntry;
    index: number;
}

export const SetItem: React.FC<SetItemProps> = ({ set, index }) => {
    // Local state for immediate UI feedback + simple debounce
    const [weight, setWeight] = useState(set.weight.toString());
    const [reps, setReps] = useState(set.reps.toString());
    const [rpe, setRpe] = useState(set.rpe?.toString() || '');
    const [isCompleted, setIsCompleted] = useState(false); // Visual cue only for MVP, or track logic?

    // Sync to DB on debounce
    const debouncedWeight = useDebounce(weight, 500);
    const debouncedReps = useDebounce(reps, 500);
    const debouncedRpe = useDebounce(rpe, 500);

    useEffect(() => {
        // Prevent updates if initial load or no change
        if (Number(debouncedWeight) === set.weight &&
            Number(debouncedReps) === set.reps &&
            (debouncedRpe === '' ? undefined : Number(debouncedRpe)) === set.rpe) {
            return;
        }

        db.sets.update(set.id!, {
            weight: Number(debouncedWeight),
            reps: Number(debouncedReps),
            rpe: debouncedRpe ? Number(debouncedRpe) : undefined,
            updatedAt: Date.now()
        }).catch(console.error);
    }, [debouncedWeight, debouncedReps, debouncedRpe, set.id, set.weight, set.reps, set.rpe]);

    // Sync local state if remote changes (e.g. sync?) - simplified: usually only local edits happen in active session.
    // If we wanted robust 2-way sync with hook, we should just use props, but input cursors jump.
    // So we assume this component owns the edit session.

    const handleDelete = async () => {
        await db.sets.delete(set.id!);
        // Re-number orders if we want to be clean, but not strictly necessary for MVP
    };

    const handleComplete = () => {
        setIsCompleted(!isCompleted);
        // Could start timer here
    };

    // Input styles
    const inputClass = "w-full bg-transparent border-b border-border text-center focus:border-accent focus:outline-none py-1 text-lg font-mono";

    return (
        <div
            className={clsx(
                "grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center p-2 rounded transition-colors",
                isCompleted ? "bg-accent/10" : "bg-bg-tertiary"
            )}
        >
            <div
                className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors select-none",
                    isCompleted ? "bg-accent text-white" : "bg-bg-primary text-text-secondary"
                )}
                onClick={handleComplete}
            >
                {index + 1}
            </div>

            <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className={inputClass}
                placeholder="0"
            />

            <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={e => setReps(e.target.value)}
                className={inputClass}
                placeholder="0"
            />

            <input
                type="number"
                inputMode="decimal"
                value={rpe}
                onChange={e => setRpe(e.target.value)}
                className={inputClass}
                placeholder="-"
                max={10}
            />

            <button onClick={handleDelete} className="text-text-tertiary hover:text-danger w-8 flex justify-center">
                <Trash2 size={16} />
            </button>
        </div>
    );
};
