import React from 'react';
import type { WorkoutExercise } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Dumbbell, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../common/Card';
import { SetItem } from './SetItem';

interface SetListProps {
    workoutExercise: WorkoutExercise;
    exerciseName: string;
    isUnilateral?: boolean;
    index?: number;
    totalCount?: number;
    onDelete?: () => void;
    isConfirmingDelete?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

export const SetList: React.FC<SetListProps> = ({
    workoutExercise,
    exerciseName,
    isUnilateral,
    index,
    totalCount,
    onDelete,
    isConfirmingDelete,
    onMoveUp,
    onMoveDown
}) => {
    const [trackSides, setTrackSides] = React.useState(isUnilateral || false);

    const exercise = useLiveQuery(
        () => db.exercises.where('uuid').equals(workoutExercise.exerciseId).first(),
        [workoutExercise.exerciseId]
    );

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

    const handleAddVariation = async () => {
        if (!exercise?.id) return;
        const raw = prompt('Add variation (e.g., Overhand / Underhand):');
        const next = raw?.trim();
        if (!next) return;

        const current = Array.isArray(exercise.variations) ? exercise.variations : [];
        const exists = current.some(v => v.toLowerCase() === next.toLowerCase());
        if (exists) return;

        await db.exercises.update(exercise.id, {
            variations: [...current, next],
            updatedAt: Date.now()
        });
    };



    return (
        <Card className="flex flex-col bg-bg-secondary p-0 rounded-xl border border-border/60 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-10">
            {/* Header Section matching reference */}
            <div className="flex flex-row p-4 gap-4 border-b border-border/40 items-center justify-between relative">

                <div className="flex items-center gap-4 flex-1">
                    {/* Image Placeholder */}
                    <div className="w-20 h-20 bg-white border border-border/20 rounded-lg flex items-center justify-center text-text-tertiary flex-shrink-0 p-2 shadow-sm">
                        <Dumbbell size={32} strokeWidth={1} className="text-text-tertiary/50" />
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1">
                        <h3 className="font-bold text-lg text-text-primary leading-tight">{exerciseName}</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-text-secondary leading-snug capitalize font-medium">
                                {exercise?.muscleGroup?.replace('_', ' ') || 'General'}
                            </p>
                            <button
                                onClick={handleAddVariation}
                                className="text-xs font-bold px-2 py-0.5 rounded transition-all bg-bg-tertiary text-text-tertiary hover:bg-bg-tertiary/80"
                                title="Add variation"
                            >
                                Var+
                            </button>
                            {/* L/R Toggle */}
                            <button
                                onClick={() => setTrackSides(!trackSides)}
                                className={`text-xs font-bold px-2 py-0.5 rounded transition-all ${trackSides
                                    ? 'bg-accent text-white'
                                    : 'bg-bg-tertiary text-text-tertiary hover:bg-bg-tertiary/80'
                                    }`}
                                title="Track left/right sides separately"
                            >
                                L/R
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Controls + Stats */}
                <div className="flex items-center gap-3">
                    {/* Move buttons */}
                    {onMoveUp && onMoveDown && typeof index === 'number' && typeof totalCount === 'number' && (
                        <div className="flex flex-col gap-0.5">
                            <button
                                onClick={onMoveUp}
                                disabled={index === 0}
                                className="text-text-tertiary hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-1"
                                title="Move up"
                            >
                                <ChevronUp size={20} strokeWidth={2.5} />
                            </button>
                            <button
                                onClick={onMoveDown}
                                disabled={index === totalCount - 1}
                                className="text-text-tertiary hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-1"
                                title="Move down"
                            >
                                <ChevronDown size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}

                    {/* Stats Summary */}
                    <div className="flex gap-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase font-bold text-text-tertiary/70 tracking-wider">Sets</span>
                            <span className="text-xl font-bold text-text-primary">{sets?.length || 0}</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase font-bold text-text-tertiary/70 tracking-wider">Reps</span>
                            <span className="text-xl font-bold text-text-primary text-text-tertiary/30">-</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase font-bold text-text-tertiary/70 tracking-wider">Kg</span>
                            <span className="text-xl font-bold text-text-primary text-text-tertiary/30">-</span>
                        </div>
                    </div>

                    {/* Delete button */}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className={`transition-colors p-2 rounded-lg flex items-center gap-1 ${isConfirmingDelete
                                ? 'bg-danger/20 text-danger font-bold text-xs'
                                : 'text-text-tertiary hover:text-danger hover:bg-danger/10'
                                }`}
                            title="Remove exercise"
                        >
                            <Trash2 size={20} />
                            {isConfirmingDelete && <span>Sure?</span>}
                        </button>
                    )}
                </div>
            </div>



            {/* Sets List */}
            <div className="flex flex-col px-4 pb-4 gap-1 bg-bg-tertiary/10">
                {sets?.map((set, index) => (
                    <SetItem
                        key={set.uuid}
                        set={set}
                        index={index}
                        isUnilateral={trackSides}
                        variations={exercise?.variations || []}
                    />
                ))}

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
};
