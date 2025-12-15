import React, { useEffect, useState } from 'react';
import type { SetEntry } from '../../types';
import { db } from '../../db/db';
import { Trash2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useDebounce } from '../../hooks/useDebounce';

interface SetItemProps {
    set: SetEntry;
    index: number;
    isUnilateral?: boolean;
}

export const SetItem: React.FC<SetItemProps> = ({ set, index, isUnilateral }) => {
    const [weight, setWeight] = useState(set.weight.toString());
    const [reps, setReps] = useState(set.reps.toString());
    const [rpe, setRpe] = useState(set.rpe?.toString() || '');
    const [side, setSide] = useState<'left' | 'right' | undefined>(set.side);
    const [isFailure, setIsFailure] = useState(set.isFailure);
    const [failureRep, setFailureRep] = useState(set.failureRep?.toString() || set.reps.toString());

    const debouncedWeight = useDebounce(weight, 500);
    const debouncedReps = useDebounce(reps, 500);
    const debouncedRpe = useDebounce(rpe, 500);
    const debouncedFailureRep = useDebounce(failureRep, 500);

    useEffect(() => {
        if (Number(debouncedWeight) === set.weight &&
            Number(debouncedReps) === set.reps &&
            (debouncedRpe === '' ? undefined : Number(debouncedRpe)) === set.rpe &&
            (isFailure ? Number(debouncedFailureRep) : undefined) === set.failureRep) {
            return;
        }

        db.sets.update(set.id!, {
            weight: Number(debouncedWeight),
            reps: Number(debouncedReps),
            rpe: debouncedRpe ? Number(debouncedRpe) : undefined,
            failureRep: isFailure ? Number(debouncedFailureRep) : undefined,
            updatedAt: Date.now()
        }).catch(console.error);
    }, [debouncedWeight, debouncedReps, debouncedRpe, debouncedFailureRep, isFailure, set.id, set.weight, set.reps, set.rpe, set.failureRep]);

    const handleSideChange = (newSide: 'left' | 'right') => {
        setSide(newSide);
        db.sets.update(set.id!, { side: newSide, updatedAt: Date.now() });
    };

    const toggleFailure = () => {
        const newVal = !isFailure;
        setIsFailure(newVal);
        // If enabling failure and no failureRep set, default to current reps
        if (newVal && !failureRep) {
            setFailureRep(reps);
        }
        db.sets.update(set.id!, {
            isFailure: newVal,
            failureRep: newVal ? Number(failureRep || reps) : undefined,
            updatedAt: Date.now()
        });
    };

    const handleDelete = async () => {
        await db.sets.delete(set.id!);
    };

    const labelClass = "text-[10px] uppercase text-text-tertiary font-semibold tracking-wider mb-1 text-center";
    const inputWrapperClass = "flex flex-col flex-1 min-w-[60px]";
    const inputClass = "w-full bg-bg-secondary border border-border rounded-md px-1 py-2 text-center text-lg font-bold focus:border-accent focus:outline-none transition-colors";

    return (
        <div className="flex flex-col gap-3 bg-bg-tertiary/50 border border-border/50 rounded-xl p-3 mb-2">
            {/* Main Inputs Row */}
            <div className="flex items-start gap-3">
                <div className="flex flex-col justify-center items-center gap-1 pt-6">
                    <div className="w-6 h-6 rounded-full bg-bg-secondary text-text-secondary flex items-center justify-center text-xs font-bold select-none border border-border">
                        {index + 1}
                    </div>
                </div>

                <div className={inputWrapperClass}>
                    <span className={labelClass}>kg</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className={inputClass}
                        placeholder="0"
                    />
                </div>

                <div className={inputWrapperClass}>
                    <span className={labelClass}>Reps</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={reps}
                        onChange={e => {
                            setReps(e.target.value);
                            // Optional: sync failureRep if needed, but keeping separate is often safer
                        }}
                        className={inputClass}
                        placeholder="0"
                    />
                </div>

                <div className={inputWrapperClass}>
                    <span className={labelClass}>RPE</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={rpe}
                        onChange={e => setRpe(e.target.value)}
                        className={inputClass}
                        placeholder="-"
                        max={10}
                    />
                </div>

                <div className="pt-6">
                    <button onClick={handleDelete} className="w-10 h-10 flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-md transition-colors">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Secondary Controls Row */}
            <div className="flex flex-wrap gap-4 items-center pl-9 border-t border-border/30 pt-2">
                {/* Side Selector */}
                {isUnilateral && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary font-medium">Side:</span>
                        <div className="flex bg-bg-secondary rounded-lg p-1 border border-border">
                            <button
                                onClick={() => handleSideChange('left')}
                                className={clsx(
                                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                    side === 'left' ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                                )}
                            >
                                L
                            </button>
                            <button
                                onClick={() => handleSideChange('right')}
                                className={clsx(
                                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                    side === 'right' ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                                )}
                            >
                                R
                            </button>
                        </div>
                    </div>
                )}

                {/* Failure Toggle */}
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                        <div className={clsx(
                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                            isFailure ? "bg-danger border-danger text-white" : "border-text-tertiary bg-transparent group-hover:border-text-secondary"
                        )}>
                            {isFailure && <AlertCircle size={12} fill="currentColor" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={isFailure} onChange={toggleFailure} />
                        <span className={clsx("text-xs font-medium transition-colors", isFailure ? "text-danger" : "text-text-secondary")}>
                            Failure
                        </span>
                    </label>

                    {/* Failure Rep Input (Conditional) */}
                    {isFailure && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <span className="text-xs text-text-secondary">@ Rep:</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={failureRep}
                                onChange={e => setFailureRep(e.target.value)}
                                className="w-14 bg-bg-secondary border border-border rounded px-2 py-1 text-center text-sm font-mono focus:border-danger focus:outline-none"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
