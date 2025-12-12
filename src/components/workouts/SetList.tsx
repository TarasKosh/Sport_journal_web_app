import React from 'react';
import type { WorkoutExercise, SetEntry } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { Plus, MoreHorizontal } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../common/Card';
import { SetItem } from './SetItem'; // We will create this next

interface SetListProps {
    workoutExercise: WorkoutExercise;
    exerciseName: string;
}

export const SetList: React.FC<SetListProps> = ({ workoutExercise, exerciseName }) => {
    const sets = useLiveQuery(async () => {
        const s = await db.sets.where('workoutExerciseId').equals(workoutExercise.uuid).toArray();
        return s.sort((a, b) => a.order - b.order);
    }, [workoutExercise.uuid]);

    const handleAddSet = async () => {
        // Auto-fill logic: copy previous set or default
        const lastSet = sets && sets.length > 0 ? sets[sets.length - 1] : null;

        // If no sets in this session, try to find last set from history (TODO for polish)
        // For MVP, just previous set in this list or empty

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
        <Card className="flex flex-col gap-2 bg-bg-secondary p-3">
            <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-base text-accent">{exerciseName}</h3>
                <button className="text-text-secondary"><MoreHorizontal size={18} /></button>
            </div>

            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-1 px-1 text-xs text-text-secondary uppercase font-semibold text-center">
                <div className="w-6">#</div>
                <div>kg</div>
                <div>Reps</div>
                <div>RPE</div>
                <div className="w-8"></div>
            </div>

            <div className="flex flex-col gap-1">
                {sets?.map((set, index) => (
                    <SetItem key={set.uuid} set={set} index={index} />
                ))}
            </div>

            <Button size="sm" variant="secondary" onClick={handleAddSet} className="mt-2 bg-bg-tertiary">
                <Plus size={16} className="mr-1" /> Add Set
            </Button>
        </Card>
    );
};
