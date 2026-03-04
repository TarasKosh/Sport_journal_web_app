import React, { useEffect, useState } from 'react';
import type { SetEntry } from '../../types';
import { db } from '../../db/db';
import { Trash2, CornerDownRight, Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useDebounce } from '../../hooks/useDebounce';

interface SetItemProps {
    set: SetEntry;
    index: number;
    isUnilateral?: boolean;
    variations?: string[];
    onAddVariation?: () => void;
}

// Defined outside SetItem so React keeps a stable component identity across re-renders,
// preventing input focus loss when parent state changes.
const InputWithButtons = ({
    value,
    onChange,
    onIncrement,
    onDecrement,
    placeholder = "0",
    isDanger = false
}: {
    value: string;
    onChange: (val: string) => void;
    onIncrement: () => void;
    onDecrement: () => void;
    placeholder?: string;
    isDanger?: boolean;
}) => (
    <div className={clsx(
        "flex items-center border-2 rounded-xl overflow-hidden transition-all h-14 w-full",
        isDanger ? "border-danger bg-bg-secondary" : "border-border bg-bg-secondary hover:border-accent/40"
    )}>
        <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={e => e.target.select()}
            className={clsx(
                "flex-1 bg-transparent text-center text-2xl font-bold outline-none px-2 hide-number-arrows min-w-0 pointer-events-auto",
                isDanger ? "text-danger placeholder:text-danger/30" : "text-text-primary placeholder:text-text-tertiary/30"
            )}
            placeholder={placeholder}
        />
        <div className="flex items-center h-full border-l-2 border-border flex-shrink-0">
            <button
                onClick={onDecrement}
                className={clsx(
                    "h-full px-3 transition-colors flex items-center justify-center border-r-2 border-border",
                    isDanger ? "hover:bg-danger/10 active:bg-danger/20" : "hover:bg-accent/10 active:bg-accent/20"
                )}
            >
                <Minus size={18} className={isDanger ? "text-danger" : "text-text-secondary"} strokeWidth={3} />
            </button>
            <button
                onClick={onIncrement}
                className={clsx(
                    "h-full px-3 transition-colors flex items-center justify-center",
                    isDanger ? "hover:bg-danger/10 active:bg-danger/20" : "hover:bg-accent/10 active:bg-accent/20"
                )}
            >
                <Plus size={18} className={isDanger ? "text-danger" : "text-text-secondary"} strokeWidth={3} />
            </button>
        </div>
    </div>
);

export const SetItem: React.FC<SetItemProps> = React.memo(({ set, index, isUnilateral, variations, onAddVariation }) => {
    const [weight, setWeight] = useState(set.weight.toString());
    const [reps, setReps] = useState(set.reps.toString());
    const [rpe, setRpe] = useState(set.rpe?.toString() || '');
    const [variation, setVariation] = useState(set.variation || '');
    const [side, setSide] = useState<'left' | 'right' | undefined>(set.side);
    const [isFailure, setIsFailure] = useState(set.isFailure);
    const [failureRep, setFailureRep] = useState(set.failureRep?.toString() || set.reps.toString());

    const debouncedWeight = useDebounce(weight, 500);
    const debouncedReps = useDebounce(reps, 500);
    const debouncedRpe = useDebounce(rpe, 500);
    const debouncedFailureRep = useDebounce(failureRep, 500);

    useEffect(() => {
        setVariation(set.variation || '');
    }, [set.variation]);

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

    const activeRowClass = isFailure ? "rounded border-l-4 border-l-danger" : "hover:bg-bg-secondary/30 rounded border-l-4 border-l-transparent";

    const variationOptions = React.useMemo(() => {
        const base = Array.isArray(variations) ? variations : [];
        const normalized = base.filter(v => typeof v === 'string' && v.trim().length > 0);
        const unique: string[] = [];
        for (const v of normalized) {
            if (!unique.some(x => x.toLowerCase() === v.toLowerCase())) unique.push(v);
        }
        if (variation && !unique.some(x => x.toLowerCase() === variation.toLowerCase())) {
            unique.unshift(variation);
        }
        return unique;
    }, [variations, variation]);



    return (
        <div className={clsx("py-2 px-2 transition-colors", activeRowClass)}>
            {/* Header: Set Number + Delete Button */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-sm">
                        {index + 1}
                    </div>
                    {isUnilateral && (
                        <div className="flex gap-0.5 bg-bg-tertiary rounded-lg p-0.5 border border-border/40">
                            <button
                                onClick={() => {
                                    if (side !== 'left') {
                                        setSide('left');
                                        db.sets.update(set.id!, { side: 'left', updatedAt: Date.now() });
                                    }
                                }}
                                className={clsx(
                                    "text-[10px] uppercase font-bold px-3 py-1 rounded-md cursor-pointer select-none transition-all",
                                    side === 'left' ? "bg-accent text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                                )}
                            >
                                Left
                            </button>
                            <button
                                onClick={() => {
                                    if (side !== 'right') {
                                        setSide('right');
                                        db.sets.update(set.id!, { side: 'right', updatedAt: Date.now() });
                                    }
                                }}
                                className={clsx(
                                    "text-[10px] uppercase font-bold px-3 py-1 rounded-md cursor-pointer select-none transition-all",
                                    side === 'right' ? "bg-accent text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                                )}
                            >
                                Right
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleDelete}
                    className="p-2 text-text-tertiary hover:text-danger transition-colors opacity-40 hover:opacity-100"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Variation Picker (Horizontal Scroll) */}
            <div className="mb-4">
                <div className="text-[9px] uppercase font-black text-text-tertiary tracking-widest mb-2 px-1">Variation</div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 no-scrollbar">
                    {/* Always visible Default option */}
                    <button
                        onClick={() => {
                            setVariation('');
                            db.sets.update(set.id!, { variation: undefined, updatedAt: Date.now() });
                        }}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-2 transition-all",
                            variation === ''
                                ? "bg-accent border-accent text-white shadow-md shadow-accent/20"
                                : "bg-bg-secondary border-border/60 text-text-tertiary hover:border-accent/40"
                        )}
                    >
                        Default
                    </button>

                    {/* Custom Variations */}
                    {variationOptions.map(v => (
                        <button
                            key={v}
                            onClick={() => {
                                setVariation(v);
                                db.sets.update(set.id!, { variation: v, updatedAt: Date.now() });
                            }}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-2 transition-all",
                                variation === v
                                    ? "bg-accent border-accent text-white shadow-md shadow-accent/20"
                                    : "bg-bg-secondary border-border/60 text-text-tertiary hover:border-accent/40"
                            )}
                        >
                            {v}
                        </button>
                    ))}

                    {/* Add New Button */}
                    <button
                        onClick={onAddVariation}
                        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-bg-tertiary text-text-tertiary border-2 border-dashed border-border/60 hover:border-accent hover:text-accent transition-all active:scale-90"
                        title="Add new variation"
                    >
                        <Plus size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Input Fields - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* KG */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">KG</div>
                    <InputWithButtons
                        value={weight}
                        onChange={setWeight}
                        onIncrement={() => setWeight((Number(weight) + 2.5).toString())}
                        onDecrement={() => setWeight(Math.max(0, Number(weight) - 2.5).toString())}
                    />
                </div>

                {/* Reps */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">REPS</div>
                    <InputWithButtons
                        value={reps}
                        onChange={setReps}
                        onIncrement={() => setReps((Number(reps) + 1).toString())}
                        onDecrement={() => setReps(Math.max(0, Number(reps) - 1).toString())}
                        isDanger={isFailure}
                    />
                </div>

                {/* RPE */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">RPE</div>
                    <InputWithButtons
                        value={rpe}
                        onChange={setRpe}
                        onIncrement={() => setRpe(rpe ? Math.min(10, Number(rpe) + 0.5).toString() : '10')}
                        onDecrement={() => setRpe(rpe ? Math.max(0, Number(rpe) - 0.5).toString() : '10')}
                        placeholder="-"
                    />
                </div>
            </div>

            {/* Fail Checkbox */}
            <div className="mt-2">
                <button
                    onClick={toggleFailure}
                    className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium text-xs",
                        isFailure
                            ? "bg-red-600 border-2 border-red-700 text-white shadow-lg"
                            : "border-2 border-border bg-white text-text-secondary hover:border-accent hover:bg-accent/5 hover:text-accent"
                    )}
                >
                    <span className="text-sm">{isFailure ? '✕' : '✓'}</span>
                    <span>{isFailure ? 'Failed' : 'Success (No Failure)'}</span>
                </button>
            </div>

            {/* FAILURE ROW */}
            {isFailure && (
                <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <CornerDownRight size={14} className="text-danger/60" />
                        <span className="text-xs text-danger/80 font-semibold uppercase tracking-wide whitespace-nowrap">Failed @</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <InputWithButtons
                            value={failureRep}
                            onChange={setFailureRep}
                            onIncrement={() => setFailureRep((Number(failureRep) + 1).toString())}
                            onDecrement={() => setFailureRep(Math.max(0, Number(failureRep) - 1).toString())}
                            isDanger={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

