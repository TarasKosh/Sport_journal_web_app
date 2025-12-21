import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { Calendar, Edit2, Trash2, Dumbbell } from 'lucide-react';
import type { Workout } from '../../types';

interface WorkoutCardProps {
  workout: Workout;
  onEdit: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onClick: (workout: Workout, e: React.MouseEvent) => void;
}

/**
 * Card component for displaying a workout in history list
 * Shows quick metrics: duration, exercise count, total tonnage
 */
export const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout, onEdit, onDelete, onClick }) => {
  // Load exercises count and calculate tonnage
  const workoutExercises = useLiveQuery(async () => {
    return await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
  }, [workout.uuid]);

  const allSets = useLiveQuery(async () => {
    if (!workoutExercises || workoutExercises.length === 0) return [];
    const workoutExerciseUuids = workoutExercises.map(we => we.uuid);
    const sets: any[] = [];
    for (const uuid of workoutExerciseUuids) {
      const exerciseSets = await db.sets.where('workoutExerciseId').equals(uuid).toArray();
      sets.push(...exerciseSets);
    }
    return sets;
  }, [workoutExercises]);

  // Calculate quick metrics
  const metrics = React.useMemo(() => {
    if (!workoutExercises || !allSets) {
      return { exerciseCount: 0, tonnage: 0 };
    }

    let tonnage = 0;
    allSets.forEach(set => {
      if (set.reps && set.weight) {
        tonnage += set.weight * set.reps;
      }
    });

    return {
      exerciseCount: workoutExercises.length,
      tonnage: Math.round(tonnage * 10) / 10
    };
  }, [workoutExercises, allSets]);

  const workoutDayToDate = (workoutDay: string) => {
    const [y, m, d] = workoutDay.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const duration = workout.endedAt && workout.startedAt
    ? Math.round((workout.endedAt - workout.startedAt) / 1000 / 60)
    : null;

  return (
    <Card 
      className="flex flex-col gap-2 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
      onClick={(e) => onClick(workout, e)}
    >
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Calendar size={14} />
        <span>{workoutDayToDate(workout.workoutDay).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="text-accent hover:text-accent-hover transition"
            title="Edit workout"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(workout);
            }}
          >
            <Edit2 size={18} />
          </button>
          <button
            className="text-danger hover:text-danger/80 transition"
            title="Delete workout"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(workout);
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-bold text-lg text-text-primary flex-1">{workout.title || "Workout"}</h3>
        {duration !== null && (
          <span className="text-xs font-semibold bg-accent/10 text-accent px-2.5 py-1 rounded-lg flex-shrink-0">
            {duration} min
          </span>
        )}
      </div>
      {/* Quick metrics */}
      <div className="flex items-center gap-3 text-xs pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <Dumbbell size={14} className="text-accent/70" />
          <span className="font-medium">{metrics.exerciseCount} {metrics.exerciseCount === 1 ? 'exercise' : 'exercises'}</span>
        </div>
        {metrics.tonnage > 0 && (
          <div className="text-text-secondary">
            <span className="font-semibold text-accent">{metrics.tonnage} kg</span>
            <span className="text-text-tertiary ml-1">tonnage</span>
          </div>
        )}
      </div>
    </Card>
  );
};

