import React, { useEffect, useState } from 'react';
import type { SetEntry } from '../../types';
import { db } from '../../db/db';
import { Trash2, AlertCircle, CornerDownRight } from 'lucide-react';
import clsx from 'clsx';
import { useDebounce } from '../../hooks/useDebounce';

interface SetItemProps {
    set: SetEntry;
    index: number;
    isUnilateral?: boolean;
    gridStyle: React.CSSProperties;
}

export const SetItem: React.FC<SetItemProps> = ({ set, index, isUnilateral, gridStyle }) => {
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

    const handleSideChange = () => {
        const newSide = side === 'left' ? 'right' : 'left';
        setSide(newSide);
        db.sets.update(set.id!, { side: newSide, updatedAt: Date.now() });
    };

    const toggleFailure = () => {
        const newVal = !isFailure;
        setIsFailure(newVal);
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

    // Styling - Ghost Inputs -> Look like text but editable.
    // Background transparent, border transparent, underline on focus? Or just box.
    // matching the clean table look.
    const inputClass = "w-full bg-transparent border-b border-border/50 focus:border-accent hover:bg-bg-tertiary/50 rounded-lg h-10 text-center text-lg font-bold outline-none transition-all placeholder:text-text-tertiary/20 text-text-primary focus:bg-bg-tertiary focus:shadow-sm";
    const activeRowClass = isFailure ? "bg-danger/5 rounded border-l-2 border-l-danger" : "hover:bg-bg-secondary/30 rounded border-l-2 border-l-transparent";

    return (
        <div className={clsx("flex flex-col py-1 transition-colors", activeRowClass)}>

            {/* The GRID ROW */}
            <div style={gridStyle}>

                {/* 1. Set Number + Side */}
                <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="text-sm font-bold text-text-tertiary">
                        {index + 1}
                    </div>
                    {isUnilateral && (
                        <button
                            onClick={handleSideChange}
                            className={clsx(
                                "text-[10px] uppercase font-bold leading-none px-1 rounded cursor-pointer select-none transition-all w-5 text-center",
                                side === 'left' ? "text-accent bg-accent/10" : "text-text-tertiary bg-text-tertiary/10 scale-90"
                            )}
                        >
                            {side === 'left' ? 'L' : 'R'}
                        </button>
                    )}
                </div>

                {/* 2. KG */}
                <div className="relative group">
                    <input
                        type="number"
                        inputMode="decimal"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className={inputClass}
                        placeholder="0"
                    />
                </div>

                {/* 3. Reps */}
                <div className="relative group">
                    <input
                        type="number"
                        inputMode="numeric"
                        value={reps}
                        onChange={e => setReps(e.target.value)}
                        className={clsx(inputClass, isFailure && "text-danger font-bold")}
                        placeholder="0"
                    />
                </div>

                {/* 4. RPE */}
                <div className="relative group">
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

                {/* 5. Controls */}
                <div className="flex flex-col items-center justify-center gap-1">
                    <button
                        onClick={toggleFailure}
                        className={clsx(
                            "flex items-center justify-center transition-all w-8 h-8 rounded-full",
                            isFailure ? "bg-danger text-white shadow-sm scale-100" : "text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary opacity-60 hover:opacity-100 scale-90 hover:scale-100"
                        )}
                        title="Toggle Failure"
                    >
                        <AlertCircle size={16} fill={isFailure ? "currentColor" : "none"} />
                    </button>
                </div>
            </div>

            {/* FAILURE EXPANDED */}
            {isFailure && (
                <div className="px-2 mt-2 mb-1">
                    <div style={gridStyle} className="items-center">
                        <div className="flex items-center justify-center">
                            <CornerDownRight size={14} className="text-danger/60" />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                            <span className="text-xs text-danger/80 font-semibold uppercase tracking-wide whitespace-nowrap">Failed @</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={failureRep}
                                onChange={e => setFailureRep(e.target.value)}
                                className="w-full bg-transparent border-b border-danger/40 focus:border-danger hover:bg-danger/5 rounded-lg h-10 text-center text-lg font-bold outline-none transition-all text-danger focus:bg-danger/5 focus:shadow-sm"
                                placeholder="0"
                            />
                        </div>
                        <div></div>
                        <div className="flex items-center justify-center">
                            <button
                                onClick={handleDelete}
                                className="text-text-tertiary hover:text-danger transition-colors opacity-60 hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
