import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Workout, WorkoutExercise, SetEntry, Exercise } from '../../types';
import { ArrowLeft, Edit2, Calendar, Clock, Heart, Scale, FileText, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { EditWorkoutModal } from '../workouts/EditWorkoutModal';

interface WorkoutDetailsViewProps {
  workout: Workout;
  onBack: () => void;
}

/**
 * Detailed view of a completed workout:
 * - Metadata (date, duration, mood, body weight, notes)
 * - List of exercises with sets table
 * - Summary statistics (total exercises, sets, tonnage)
 */
export const WorkoutDetailsView: React.FC<WorkoutDetailsViewProps> = ({ workout, onBack }) => {
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());

  // Load exercises for this workout
  const workoutExercises = useLiveQuery(async () => {
    const list = await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
    return list.sort((a, b) => a.order - b.order);
  }, [workout.uuid]);

  // Load all sets for all exercises
  const allSets = useLiveQuery(async () => {
    if (!workoutExercises || workoutExercises.length === 0) return [];
    const workoutExerciseUuids = workoutExercises.map(we => we.uuid);
    const sets: SetEntry[] = [];
    for (const uuid of workoutExerciseUuids) {
      const exerciseSets = await db.sets.where('workoutExerciseId').equals(uuid).toArray();
      sets.push(...exerciseSets);
    }
    return sets.sort((a, b) => {
      const weA = workoutExercises.find(we => we.uuid === a.workoutExerciseId);
      const weB = workoutExercises.find(we => we.uuid === b.workoutExerciseId);
      if (!weA || !weB) return 0;
      if (weA.order !== weB.order) return weA.order - weB.order;
      return a.order - b.order;
    });
  }, [workoutExercises]);

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (!workoutExercises || !allSets) {
      return {
        totalExercises: 0,
        totalSets: 0,
        totalReps: 0,
        totalTonnage: 0
      };
    }

    let totalReps = 0;
    let totalTonnage = 0;

    allSets.forEach(set => {
      if (set.reps && !isNaN(set.reps)) {
        totalReps += set.reps;
        const load = set.weight || 0;
        totalTonnage += load * set.reps;
      }
    });

    return {
      totalExercises: workoutExercises.length,
      totalSets: allSets.length,
      totalReps,
      totalTonnage: Math.round(totalTonnage * 10) / 10 // Round to 1 decimal
    };
  }, [workoutExercises, allSets]);

  // Format duration
  const duration = workout.endedAt && workout.startedAt
    ? Math.round((workout.endedAt - workout.startedAt) / 1000 / 60)
    : null;

  // Format date
  const workoutDayToDate = (workoutDay: string) => {
    const [y, m, d] = workoutDay.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const workoutDate = workoutDayToDate(workout.workoutDay);

  // Toggle exercise expansion
  const toggleExercise = (exerciseUuid: string) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseUuid)) {
        next.delete(exerciseUuid);
      } else {
        next.add(exerciseUuid);
      }
      return next;
    });
  };

  // Get mood emoji
  const getMoodEmoji = (mood?: string) => {
    switch (mood) {
      case 'great': return '😊';
      case 'good': return '🙂';
      case 'neutral': return '😐';
      case 'bad': return '😞';
      case 'terrible': return '😢';
      default: return '—';
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex-shrink-0 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold">{workout.title || "Workout"}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingWorkout(workout)}
            className="text-white hover:bg-white/20"
            title="Edit workout"
          >
            <Edit2 size={20} />
          </Button>
        </div>

        {/* Quick metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-white/80" />
            <span className="text-white/90">
              {workoutDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
          {duration !== null && (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-white/80" />
              <span className="text-white/90">{duration} min</span>
            </div>
          )}
          {workout.mood && (
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-white/80" />
              <span className="text-white/90">{getMoodEmoji(workout.mood)} {workout.mood}</span>
            </div>
          )}
          {workout.bodyWeight && (
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-white/80" />
              <span className="text-white/90">{workout.bodyWeight} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 pb-20">
        {/* Summary Statistics */}
        <Card className="p-4">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Dumbbell size={20} className="text-accent" />
            Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-text-tertiary uppercase font-semibold mb-1">Exercises</div>
              <div className="text-2xl font-bold text-text-primary">{summary.totalExercises}</div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary uppercase font-semibold mb-1">Sets</div>
              <div className="text-2xl font-bold text-text-primary">{summary.totalSets}</div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary uppercase font-semibold mb-1">Reps</div>
              <div className="text-2xl font-bold text-text-primary">{summary.totalReps || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary uppercase font-semibold mb-1">Tonnage (kg)</div>
              <div className="text-2xl font-bold text-text-primary">{summary.totalTonnage || '—'}</div>
            </div>
          </div>
        </Card>

        {/* Notes */}
        {workout.notes && (
          <Card className="p-4">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              Notes
            </h2>
            <p className="text-text-secondary whitespace-pre-wrap">{workout.notes}</p>
          </Card>
        )}

        {/* Exercises List */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Exercises</h2>
          {!workoutExercises || workoutExercises.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-text-secondary">No exercises logged for this workout.</p>
            </Card>
          ) : (
            workoutExercises.map((we) => (
              <ExerciseCard
                key={we.uuid}
                workoutExercise={we}
                sets={allSets?.filter(s => s.workoutExerciseId === we.uuid).sort((a, b) => a.order - b.order) || []}
                isExpanded={expandedExercises.has(we.uuid)}
                onToggle={() => toggleExercise(we.uuid)}
              />
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingWorkout && (
        <EditWorkoutModal
          workout={editingWorkout}
          isOpen={!!editingWorkout}
          onClose={() => setEditingWorkout(null)}
          onSaved={() => setEditingWorkout(null)}
        />
      )}
    </div>
  );
};

// Exercise Card Component
interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  sets: SetEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ workoutExercise, sets, isExpanded, onToggle }) => {
  const exercise = useLiveQuery(() => db.exercises.where('uuid').equals(workoutExercise.exerciseId).first());

  if (!exercise) {
    return (
      <Card className="p-4">
        <div className="animate-pulse">Loading exercise...</div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Exercise Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-bg-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Dumbbell size={24} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-text-primary truncate">{exercise.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-text-secondary capitalize">{exercise.muscleGroup?.replace('_', ' ')}</span>
              {workoutExercise.notes && (
                <span className="text-xs text-text-tertiary">• {workoutExercise.notes}</span>
              )}
              <span className="text-xs text-text-tertiary">• {sets.length} sets</span>
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} className="text-text-tertiary" /> : <ChevronDown size={20} className="text-text-tertiary" />}
      </button>

      {/* Sets Table */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          {sets.length === 0 ? (
            <div className="py-8 text-center text-text-secondary text-sm">No sets logged</div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-tertiary text-xs uppercase font-semibold">
                    <th className="text-left py-2 px-2">Set</th>
                    <th className="text-right py-2 px-2">Weight (kg)</th>
                    <th className="text-right py-2 px-2">Reps</th>
                    <th className="text-right py-2 px-2">RPE</th>
                    {sets.some(s => s.variation) && <th className="text-left py-2 px-2">Variation</th>}
                    {sets.some(s => s.isFailure) && <th className="text-center py-2 px-2">Failure</th>}
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set, index) => (
                    <tr key={set.uuid} className="border-b border-border/50 hover:bg-bg-tertiary/30">
                      <td className="py-2 px-2 font-semibold text-text-primary">{index + 1}</td>
                      <td className="py-2 px-2 text-right text-text-primary">{set.weight || '—'}</td>
                      <td className={`py-2 px-2 text-right ${set.isFailure ? 'text-danger font-semibold' : 'text-text-primary'}`}>
                        {set.reps || '—'}
                        {set.isFailure && set.failureRep && ` (failed @ ${set.failureRep})`}
                      </td>
                      <td className="py-2 px-2 text-right text-text-secondary">{set.rpe || '—'}</td>
                      {sets.some(s => s.variation) && (
                        <td className="py-2 px-2 text-text-secondary text-xs">{set.variation || '—'}</td>
                      )}
                      {sets.some(s => s.isFailure) && (
                        <td className="py-2 px-2 text-center">
                          {set.isFailure ? <span className="text-danger font-semibold">✕</span> : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

