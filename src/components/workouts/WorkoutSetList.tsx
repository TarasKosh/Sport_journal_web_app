import React from 'react';
import type { Exercise, WorkoutExercise } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Dumbbell, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '../common/Card';
import { SetItem } from './SetItem';
import { SetRepository, type NewSetInput } from '../../data/repositories/SetRepository';
import { ExerciseRepository } from '../../data/repositories/ExerciseRepository';

interface SetListProps {
    workoutExercise: WorkoutExercise;
    exercise?: Exercise;
    index?: number;
    totalCount?: number;
    /** Receives the workout-exercise uuid, not the local auto-increment id. */
    onDelete?: (workoutExerciseUuid: string) => void;
    isConfirmingDelete?: boolean;
    onMove?: (workoutExerciseUuid: string, direction: 'up' | 'down') => void;
}

export const SetList: React.FC<SetListProps> = React.memo(({
    workoutExercise,
    exercise,
    index,
    totalCount,
    onDelete,
    isConfirmingDelete,
    onMove,
}) => {
    const [trackSides, setTrackSides] = React.useState(exercise?.isUnilateral || false);
    // Whether the user has toggled the L/R switch themselves — an explicit choice must
    // survive a late-arriving exercise re-applying its default below.
    const trackSidesTouched = React.useRef(false);
    // `exercise` resolves after the first render when `useExerciseIndex` is still loading,
    // so the state initializer alone would miss the unilateral default. Re-apply it when
    // the exercise (or its flag) changes, unless the user already chose.
    React.useEffect(() => {
        if (trackSidesTouched.current) return;
        setTrackSides(exercise?.isUnilateral || false);
    }, [exercise?.uuid, exercise?.isUnilateral]);
    const [showAddVariation, setShowAddVariation] = React.useState(false);
    const [newVariation, setNewVariation] = React.useState('');
    const variations = React.useMemo(() => exercise?.variations || [], [exercise?.variations]);

    const sets = useLiveQuery(
        () => SetRepository.listByWorkoutExercise(workoutExercise.uuid),
        [workoutExercise.uuid],
    );

    const handleAddSet = async () => {
        const lastSet = sets && sets.length > 0 ? sets[sets.length - 1] : null;

        const defaults: NewSetInput = lastSet
            ? {
                weight: lastSet.weight,
                reps: lastSet.reps,
                variation: lastSet.variation,
                rpe: lastSet.rpe,
                rir: lastSet.rir,
            }
            : {};

        // First set of the exercise: prefill the weight from the last time it was performed.
        // `lastPerformance` orders by workout date, so editing an old workout no longer
        // promotes it to "latest" and prefills the wrong load.
        if (!lastSet) {
            const previous = await SetRepository.lastPerformance(workoutExercise.exerciseId, {
                excludeWorkoutExerciseUuid: workoutExercise.uuid,
            });
            if (previous) {
                defaults.weight = previous.weight;
            }
        }

        await SetRepository.add(workoutExercise.uuid, {
            ...defaults,
            side: trackSides ? 'left' : undefined,
            isWarmup: false,
            isFailure: false,
        });
    };

    const handleSaveVariation = async () => {
        if (exercise?.id == null) return;
        const next = newVariation.trim();
        if (!next) return;

        await ExerciseRepository.addVariation(exercise.id, next);
        setNewVariation('');
        setShowAddVariation(false);
    };

    const handleCancelVariation = () => {
        setNewVariation('');
        setShowAddVariation(false);
    };

    return (
        <Card className="flex flex-col bg-bg-secondary p-0 rounded-xl border border-border/60 shadow-md overflow-hidden animate-slide-up">
            {/* Redesigned Multi-row Header */}
            <div className="flex flex-col p-4 gap-3 border-b border-border/40 bg-bg-secondary relative">

                {/* Row 1: Title and Delete */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 bg-white border border-border/20 rounded-xl flex items-center justify-center text-text-tertiary flex-shrink-0 p-2 shadow-sm">
                            <Dumbbell size={24} strokeWidth={1.5} className="text-accent/60" />
                        </div>
                        <h3 className="font-extrabold text-lg text-text-primary leading-tight truncate">
                            {exercise?.name || 'Unknown'}
                        </h3>
                    </div>

                    {/* Delete button - Always accessible in top right */}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(workoutExercise.uuid)}
                            className={`transition-all p-2.5 rounded-xl flex items-center gap-2 ${isConfirmingDelete
                                ? 'bg-danger text-white font-bold shadow-lg shadow-danger/20'
                                : 'bg-bg-tertiary text-text-tertiary hover:text-danger hover:bg-danger/10'
                                }`}
                            title="Remove exercise"
                            aria-label="Delete exercise"
                        >
                            <Trash2 size={18} />
                            {isConfirmingDelete && <span className="text-xs">Delete?</span>}
                        </button>
                    )}
                </div>

                {/* Row 2: Options & Badges */}
                <div className="flex flex-wrap items-center gap-2 ml-1">
                    <span className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider">
                        {exercise?.muscleGroup?.replace('_', ' ') || 'General'}
                    </span>

                    <div className="h-4 w-px bg-border/40 mx-1" />

                    <button
                        onClick={() => {
                            trackSidesTouched.current = true;
                            setTrackSides(!trackSides);
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border ${trackSides
                            ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                            : 'bg-bg-tertiary text-text-secondary border-border/40 hover:border-accent/40'
                            }`}
                    >
                        {trackSides ? 'L/R Active' : 'L/R Off'}
                    </button>
                </div>

                {/* Row 3: Move Controls & Stats */}
                <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/20">
                    <div className="flex items-center gap-1 bg-bg-tertiary/50 p-1 rounded-xl border border-border/40">
                        {onMove && typeof index === 'number' && typeof totalCount === 'number' && (
                            <>
                                <button
                                    onClick={() => onMove(workoutExercise.uuid, 'up')}
                                    disabled={index === 0}
                                    className="text-text-tertiary hover:text-accent disabled:opacity-20 transition-all p-1.5 hover:bg-white rounded-lg"
                                    aria-label="Move exercise up"
                                >
                                    <ChevronUp size={20} strokeWidth={2.5} />
                                </button>
                                <div className="w-px h-4 bg-border/40" />
                                <button
                                    onClick={() => onMove(workoutExercise.uuid, 'down')}
                                    disabled={index === totalCount - 1}
                                    className="text-text-tertiary hover:text-accent disabled:opacity-20 transition-all p-1.5 hover:bg-white rounded-lg"
                                    aria-label="Move exercise down"
                                >
                                    <ChevronDown size={20} strokeWidth={2.5} />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-4 px-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase font-black text-text-tertiary tracking-widest leading-none mb-1">Total Sets</span>
                            <span className="text-xl font-black text-accent leading-none">{sets?.length || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sets List */}
            <div className="flex flex-col px-4 pb-4 gap-1 bg-bg-tertiary/10">
                {sets?.map((set, index) => (
                    <SetItem
                        key={set.uuid}
                        entry={set}
                        index={index}
                        isUnilateral={trackSides}
                        variations={variations}
                        onAddVariation={() => setShowAddVariation(true)}
                    />
                ))}

                {showAddVariation && (
                    <div className="flex items-center gap-2 px-2 py-2 bg-bg-secondary rounded-xl border border-border/60">
                        <input
                            type="text"
                            value={newVariation}
                            onChange={e => setNewVariation(e.target.value)}
                            placeholder="Variation name..."
                            aria-label="New variation name"
                            className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                            autoFocus
                        />
                        <button
                            onClick={handleSaveVariation}
                            aria-label="Save variation"
                            className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-all"
                        >
                            Save
                        </button>
                        <button
                            onClick={handleCancelVariation}
                            aria-label="Cancel variation"
                            className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-sm font-bold hover:bg-bg-tertiary/70 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Add Set Button - Prominent and visible */}
                <button
                    onClick={handleAddSet}
                    className="flex items-center justify-center gap-2 px-6 py-4 mt-4 rounded-xl bg-accent hover:bg-accent-hover text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98] font-bold text-base"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>Add Set</span>
                </button>
            </div>
        </Card>
    );
});
