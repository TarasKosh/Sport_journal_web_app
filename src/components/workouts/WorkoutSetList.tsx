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
    onMoveUp,
    onMoveDown
}) => {
    const exercise = useLiveQuery(() => db.exercises.get(workoutExercise.exerciseId), [workoutExercise.exerciseId]);

    const sets = useLiveQuery(async () => {
        const s = await db.sets.where('workoutExerciseId').equals(workoutExercise.uuid).toArray();
        return s.sort((a, b) => a.order - b.order);
    }, [workoutExercise.uuid]);

    const handleAddSet = async () => {
        const lastSet = sets && sets.length > 0 ? sets[sets.length - 1] : null;

        await db.sets.add({
            uuid: uuidv4(),
            workoutExerciseId: workoutExercise.uuid,
            order: sets ? sets.length : 0,
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 0,
            rpe: lastSet ? lastSet.rpe : undefined,
            isWarmup: false,
            isFailure: false,
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
                        <p className="text-sm text-text-secondary leading-snug capitalize font-medium">
                            {exercise?.muscleGroup?.replace('_', ' ') || 'General'}
                        </p>
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
                            className="text-text-tertiary hover:text-danger transition-colors p-2 rounded-lg hover:bg-danger/10"
                            title="Remove exercise"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            </div>



            {/* Sets List */}
            <div className="flex flex-col px-4 pb-4 gap-1 bg-bg-tertiary/10">
                {sets?.map((set, index) => (
                    <SetItem key={set.uuid} set={set} index={index} isUnilateral={isUnilateral} />
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
