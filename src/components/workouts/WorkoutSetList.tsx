import React from 'react';
import type { Exercise, WorkoutExercise } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Dumbbell, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../common/Card';
import { SetItem } from './SetItem';

interface SetListProps {
    workoutExercise: WorkoutExercise;
    exercise?: Exercise;
    index?: number;
    totalCount?: number;
    onDelete?: (id: number) => void;
    isConfirmingDelete?: boolean;
    onMoveUp?: (index: number, direction: 'up' | 'down') => void;
    onMoveDown?: (index: number, direction: 'up' | 'down') => void;
    workoutExerciseId?: number;
}

export const SetList: React.FC<SetListProps> = React.memo(({
    workoutExercise,
    exercise,
    index,
    totalCount,
    onDelete,
    isConfirmingDelete,
    onMoveUp,
    onMoveDown,
    workoutExerciseId,
}) => {
    const [trackSides, setTrackSides] = React.useState(exercise?.isUnilateral || false);
    const [showAddVariation, setShowAddVariation] = React.useState(false);
    const [newVariation, setNewVariation] = React.useState('');
    const variations = React.useMemo(() => exercise?.variations || [], [exercise?.variations]);

    const sets = useLiveQuery(async () => {
        const s = await db.sets.where('workoutExerciseId').equals(workoutExercise.uuid).toArray();
        return s.sort((a, b) => a.order - b.order);
    }, [workoutExercise.uuid]);

    const handleAddSet = async () => {
        const lastSet = sets && sets.length > 0 ? sets[sets.length - 1] : null;

        let defaultWeight = 0;
        let defaultReps = 0;

        if (lastSet) {
            defaultWeight = lastSet.weight;
            defaultReps = lastSet.reps;
        } else {
            // First set: determine default weight
            try {
                // Priority 1: body weight entered at workout start
                const currentWorkout = await db.workouts
                    .where('uuid')
                    .equals(workoutExercise.workoutId)
                    .first();
                if (currentWorkout?.bodyWeight) {
                    defaultWeight = currentWorkout.bodyWeight;
                }

                // Priority 2 (fallback): last historical weight for this exercise
                if (defaultWeight === 0) {
                    const pastWorkoutExercises = await db.workoutExercises
                        .where('exerciseId')
                        .equals(workoutExercise.exerciseId)
                        .toArray();

                    const pastIds = pastWorkoutExercises
                        .filter(we => we.uuid !== workoutExercise.uuid)
                        .map(we => we.uuid);

                    if (pastIds.length > 0) {
                        const pastSets = await db.sets
                            .where('workoutExerciseId')
                            .anyOf(pastIds)
                            .toArray();

                        if (pastSets.length > 0) {
                            pastSets.sort((a, b) => b.updatedAt - a.updatedAt);
                            defaultWeight = pastSets[0].weight;
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch default weight", error);
            }
        }

        await db.sets.add({
            uuid: uuidv4(),
            workoutExerciseId: workoutExercise.uuid,
            order: sets ? sets.length : 0,
            weight: defaultWeight,
            reps: defaultReps,
            variation: lastSet ? lastSet.variation : undefined,
            rpe: lastSet ? lastSet.rpe : undefined,
            side: trackSides ? 'left' : undefined,
            isWarmup: false,
            isFailure: false,
            updatedAt: Date.now()
        });
    };

    const handleSaveVariation = async () => {
        if (!exercise?.id) return;
        const next = newVariation.trim();
        if (!next) return;

        const current = Array.isArray(exercise.variations) ? exercise.variations : [];
        const exists = current.some(v => v.toLowerCase() === next.toLowerCase());
        if (exists) return;

        await db.exercises.update(exercise.id, {
            variations: [...current, next],
            updatedAt: Date.now()
        });
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
                            onClick={() => { if (workoutExerciseId != null) onDelete?.(workoutExerciseId); }}
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
                        onClick={() => setTrackSides(!trackSides)}
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
                        {onMoveUp && onMoveDown && typeof index === 'number' && typeof totalCount === 'number' && (
                            <>
                                <button
                                    onClick={() => onMoveUp?.(index ?? 0, 'up')}
                                    disabled={index === 0}
                                    className="text-text-tertiary hover:text-accent disabled:opacity-20 transition-all p-1.5 hover:bg-white rounded-lg"
                                    aria-label="Move exercise up"
                                >
                                    <ChevronUp size={20} strokeWidth={2.5} />
                                </button>
                                <div className="w-px h-4 bg-border/40" />
                                <button
                                    onClick={() => onMoveDown?.(index ?? 0, 'down')}
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
