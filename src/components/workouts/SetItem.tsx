import React, { useState } from 'react';
import type { MassUnit, SetEntry } from '../../types';
import { RPEType } from '../../types';
import { Trash2, CornerDownRight, Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useDebouncedWriter } from '../../hooks/useDebouncedWriter';
import { SetRepository } from '../../data/repositories/SetRepository';
import { useSettings } from '../../hooks/useSettings';
import { displayToKg, kgToDisplay, massUnitLabel } from '../../utils/mass';

interface SetItemProps {
    entry: SetEntry;
    index: number;
    isUnilateral?: boolean;
    variations?: string[];
    onAddVariation?: () => void;
}

type Draft = {
    weight: string;
    reps: string;
    intensity: string;
    failureRep: string;
};

/** Display strings for a stored set — the single place that converts kg → display unit. */
function draftFromEntry(entry: SetEntry, massUnit: MassUnit, useRir: boolean): Draft {
    return {
        weight: kgToDisplay(entry.weight, massUnit).toString(),
        reps: entry.reps.toString(),
        intensity: useRir ? (entry.rir?.toString() ?? '') : (entry.rpe?.toString() ?? ''),
        failureRep: entry.failureRep?.toString() ?? entry.reps.toString(),
    };
}

// Defined outside SetItem so React keeps a stable component identity across re-renders,
// preventing input focus loss when parent state changes.
const InputWithButtons = ({
    value,
    onChange,
    onIncrement,
    onDecrement,
    onBlur,
    placeholder = "0",
    isDanger = false
}: {
    value: string;
    onChange: (val: string) => void;
    onIncrement: () => void;
    onDecrement: () => void;
    onBlur?: () => void;
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
            onBlur={onBlur}
            className={clsx(
                "flex-1 bg-transparent text-center text-2xl font-bold outline-none px-2 hide-number-arrows min-w-0 pointer-events-auto",
                isDanger ? "text-danger placeholder:text-danger/30" : "text-text-primary placeholder:text-text-tertiary/30"
            )}
            placeholder={placeholder}
        />
        <div className="flex items-center h-full border-l-2 border-border flex-shrink-0">
            <button
                onClick={onDecrement}
                aria-label="Decrement"
                className={clsx(
                    "h-full px-3 transition-colors flex items-center justify-center border-r-2 border-border",
                    isDanger ? "hover:bg-danger/10 active:bg-danger/20" : "hover:bg-accent/10 active:bg-accent/20"
                )}
            >
                <Minus size={18} className={isDanger ? "text-danger" : "text-text-secondary"} strokeWidth={3} />
            </button>
            <button
                onClick={onIncrement}
                aria-label="Increment"
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

export const SetItem: React.FC<SetItemProps> = React.memo(({ entry, index, isUnilateral, variations, onAddVariation }) => {
    const settings = useSettings();
    const massUnit = settings.massUnit;
    const weightStep = settings.weightStep || 2.5;
    const rpeType = settings.defaultRPEType || RPEType.RPE;
    const useRir = rpeType === RPEType.RIR;

    const [draft, setDraftState] = useState<Draft>(() => draftFromEntry(entry, massUnit, useRir));
    const draftRef = React.useRef(draft);
    const [variation, setVariation] = useState(entry.variation || '');
    const [side, setSide] = useState<'left' | 'right' | undefined>(entry.side);
    const [isFailure, setIsFailure] = useState(entry.isFailure);

    /**
     * Writes only the fields that actually changed.
     * Persistence is debounced for typing, flushed on blur/unmount/tab-hide, and immediate
     * for discrete actions (steppers, toggles) so nothing is lost when leaving the screen.
     */
    const persist = (values: Draft) => {
        const id = entry.id;
        if (id == null) return;

        const patch: Partial<SetEntry> = {};
        const weightKg = displayToKg(Number(values.weight) || 0, massUnit);
        const reps = Number(values.reps) || 0;
        const intensity = values.intensity === '' ? undefined : Number(values.intensity);
        const failureRep = isFailure ? Number(values.failureRep) || 0 : undefined;

        if (weightKg !== entry.weight) patch.weight = weightKg;
        if (reps !== entry.reps) patch.reps = reps;
        const storedIntensity = useRir ? entry.rir : entry.rpe;
        if (intensity !== storedIntensity) {
            if (useRir) patch.rir = intensity;
            else patch.rpe = intensity;
        }
        if (failureRep !== entry.failureRep) patch.failureRep = failureRep;

        if (Object.keys(patch).length === 0) return;
        void SetRepository.update(id, patch).catch(error => console.error('Failed to save set', error));
    };

    const writer = useDebouncedWriter<Draft>(persist, 500);

    const applyDraft = (next: Draft, immediate = false) => {
        draftRef.current = next;
        setDraftState(next);
        writer.schedule(next);
        if (immediate) writer.flush();
    };

    const patchDraft = (partial: Partial<Draft>, immediate = false) => {
        applyDraft({ ...draftRef.current, ...partial }, immediate);
    };

    // Re-derive the display strings when the stored row or the unit/RPE preference changes
    // (e.g. a sync merge or a settings change). Documented "adjust state during render" pattern.
    const resyncKey = `${entry.weight}|${entry.reps}|${entry.rpe ?? ''}|${entry.rir ?? ''}|${entry.failureRep ?? ''}|${massUnit}|${useRir}`;
    const [prevResyncKey, setPrevResyncKey] = useState(resyncKey);
    if (resyncKey !== prevResyncKey) {
        setPrevResyncKey(resyncKey);
        setDraftState(draftFromEntry(entry, massUnit, useRir));
    }

    // Keep the event-handler mirror in sync with the committed state (refs are never
    // written during render).
    React.useEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    const toggleFailure = () => {
        const id = entry.id;
        if (id == null) return;
        const next = !isFailure;
        setIsFailure(next);

        let nextFailureRep = draftRef.current.failureRep;
        if (next && !nextFailureRep) {
            nextFailureRep = draftRef.current.reps;
            patchDraft({ failureRep: nextFailureRep });
        }

        void SetRepository.update(id, {
            isFailure: next,
            failureRep: next ? Number(nextFailureRep || draftRef.current.reps) || 0 : undefined,
        }).catch(error => console.error('Failed to update failure flag', error));
    };

    const handleDelete = async () => {
        if (entry.id != null) {
            await SetRepository.softDelete(entry.id);
        }
    };

    const applyVariation = (next: string | undefined) => {
        setVariation(next ?? '');
        if (entry.id == null) return;
        void SetRepository.update(entry.id, { variation: next })
            .catch(error => console.error('Failed to save variation', error));
    };

    const applySide = (next: 'left' | 'right') => {
        if (side === next || entry.id == null) return;
        setSide(next);
        void SetRepository.update(entry.id, { side: next })
            .catch(error => console.error('Failed to save side', error));
    };

    const stepWeight = (delta: number) => {
        const current = Number(draftRef.current.weight) || 0;
        patchDraft({ weight: String(Math.max(0, Math.round((current + delta) * 100) / 100)) }, true);
    };

    const stepReps = (delta: number) => {
        const current = Number(draftRef.current.reps) || 0;
        patchDraft({ reps: String(Math.max(0, current + delta)) }, true);
    };

    const activeRowClass = isFailure ? "rounded border-l-4 border-l-danger" : "hover:bg-bg-secondary/30 rounded border-l-4 border-l-transparent";

    const variationOptions = React.useMemo(() => {
        const base = Array.isArray(variations) ? variations : [];
        const normalized = base.filter(v => typeof v === 'string' && v.trim().length > 0 && v.toLowerCase() !== 'default');
        const unique: string[] = [];
        for (const v of normalized) {
            if (!unique.some(x => x.toLowerCase() === v.toLowerCase())) unique.push(v);
        }
        if (variation && variation.toLowerCase() !== 'default' && !unique.some(x => x.toLowerCase() === variation.toLowerCase())) {
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
                                onClick={() => applySide('left')}
                                aria-pressed={side === 'left'}
                                className={clsx(
                                    "text-[10px] uppercase font-bold px-3 py-1 rounded-md cursor-pointer select-none transition-all",
                                    side === 'left' ? "bg-accent text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                                )}
                            >
                                Left
                            </button>
                            <button
                                onClick={() => applySide('right')}
                                aria-pressed={side === 'right'}
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
                    aria-label="Delete set"
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
                        onClick={() => applyVariation(undefined)}
                        aria-pressed={variation === ''}
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
                            onClick={() => applyVariation(v)}
                            aria-pressed={variation === v}
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
                        aria-label="Add variation"
                        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-bg-tertiary text-text-tertiary border-2 border-dashed border-border/60 hover:border-accent hover:text-accent transition-all active:scale-90"
                        title="Add new variation"
                    >
                        <Plus size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Input Fields - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">
                        {massUnitLabel(massUnit)}
                    </div>
                    <InputWithButtons
                        value={draft.weight}
                        onChange={value => patchDraft({ weight: value })}
                        onIncrement={() => stepWeight(weightStep)}
                        onDecrement={() => stepWeight(-weightStep)}
                        onBlur={writer.flush}
                    />
                </div>

                {/* Reps */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">REPS</div>
                    <InputWithButtons
                        value={draft.reps}
                        onChange={value => patchDraft({ reps: value })}
                        onIncrement={() => stepReps(1)}
                        onDecrement={() => stepReps(-1)}
                        onBlur={writer.flush}
                        isDanger={isFailure}
                    />
                </div>

                {/* RPE / RIR */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1 text-center">
                        {useRir ? 'RIR' : 'RPE'}
                    </div>
                    <InputWithButtons
                        value={draft.intensity}
                        onChange={value => patchDraft({ intensity: value })}
                        onIncrement={() => patchDraft({ intensity: draft.intensity ? Math.min(10, Number(draft.intensity) + 0.5).toString() : useRir ? '2' : '8' }, true)}
                        onDecrement={() => patchDraft({ intensity: draft.intensity ? Math.max(0, Number(draft.intensity) - 0.5).toString() : useRir ? '2' : '8' }, true)}
                        onBlur={writer.flush}
                        placeholder="-"
                    />
                </div>
            </div>

            {/* Fail Checkbox */}
            <div className="mt-2">
                <button
                    onClick={toggleFailure}
                    aria-pressed={isFailure}
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
                            value={draft.failureRep}
                            onChange={value => patchDraft({ failureRep: value })}
                            onIncrement={() => patchDraft({ failureRep: String((Number(draft.failureRep) || 0) + 1) }, true)}
                            onDecrement={() => patchDraft({ failureRep: String(Math.max(0, (Number(draft.failureRep) || 0) - 1)) }, true)}
                            onBlur={writer.flush}
                            isDanger={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});
