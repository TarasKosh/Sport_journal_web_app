import React, { useState, useEffect } from 'react';
import type { Workout, WorkoutExercise } from '../../types';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { X, Plus, Dumbbell, ChevronUp, ChevronDown, Trash2, CheckCircle } from 'lucide-react';
import { ExercisePickerModal } from './ExercisePickerModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { SetList } from './WorkoutSetList';
import { v4 as uuidv4 } from 'uuid';

interface EditWorkoutModalProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: Workout) => void;
}

/**
 * Full-featured modal for editing completed workouts:
 * - Edit metadata (title, notes, mood, bodyWeight, date)
 * - Add/remove/reorder exercises
 * - Edit sets and their content (weight, reps, RPE, etc.)
 */
export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({ workout, isOpen, onClose, onSaved }) => {
  // Metadata states
  const [title, setTitle] = useState(workout.title || '');
  const [notes, setNotes] = useState(workout.notes || '');
  const [mood, setMood] = useState(workout.mood || 'neutral');
  const [bodyWeight, setBodyWeight] = useState(workout.bodyWeight?.toString() || '');
  const [workoutDay, setWorkoutDay] = useState(workout.workoutDay || '');
  
  // Exercise picker states
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  
  // Save notification state
  const [showSavedNotification, setShowSavedNotification] = useState(false);

  // Load exercises for this workout
  const exercises = useLiveQuery(async () => {
    const list = await db.workoutExercises.where('workoutId').equals(workout.uuid).toArray();
    return list.sort((a, b) => a.order - b.order);
  }, [workout.uuid]);

  // Update local states when workout changes
  useEffect(() => {
    if (workout) {
      setTitle(workout.title || '');
      setNotes(workout.notes || '');
      setMood(workout.mood || 'neutral');
      setBodyWeight(workout.bodyWeight?.toString() || '');
      setWorkoutDay(workout.workoutDay || '');
    }
  }, [workout]);

  // Save metadata changes (debounced or on explicit save)
  const handleSaveMetadata = async () => {
    const parsedWeight = bodyWeight !== '' ? parseFloat(bodyWeight) : undefined;
    try {
      await db.workouts.update(workout.id!, {
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        mood,
        bodyWeight: parsedWeight,
        workoutDay: workoutDay.trim(),
        updatedAt: Date.now()
      });
      onSaved && onSaved({ ...workout, title, notes, mood, bodyWeight: parsedWeight, workoutDay });
      
      // Show saved notification
      setShowSavedNotification(true);
      setTimeout(() => {
        setShowSavedNotification(false);
      }, 2000);
    } catch (e) {
      console.error('Failed to save workout metadata', e);
    }
  };

  // Add exercise to workout
  const handleAddExercise = async (exerciseId: string) => {
    try {
      const count = await db.workoutExercises.where('workoutId').equals(workout.uuid).count();
      await db.workoutExercises.add({
        uuid: uuidv4(),
        workoutId: workout.uuid,
        exerciseId,
        order: count,
        updatedAt: Date.now()
      });
      setIsPickerOpen(false);
    } catch (e) {
      console.error("Failed to add exercise", e);
    }
  };

  // Add template exercises to workout
  const handleAddTemplate = async (templateId: string) => {
    try {
      const template = await db.workoutTemplates.where('uuid').equals(templateId).first();
      if (!template) return;

      const count = await db.workoutExercises.where('workoutId').equals(workout.uuid).count();
      
      // Add all exercises from template
      for (let i = 0; i < template.exercises.length; i++) {
        await db.workoutExercises.add({
          uuid: uuidv4(),
          workoutId: workout.uuid,
          exerciseId: template.exercises[i],
          order: count + i,
          updatedAt: Date.now()
        });
      }
      
      setIsTemplatePickerOpen(false);
    } catch (e) {
      console.error("Failed to add template", e);
    }
  };

  // Delete exercise from workout
  const deleteExercise = async (workoutExerciseId: number) => {
    if (confirm('Remove this exercise from workout?')) {
      const we = exercises?.find(e => e.id === workoutExerciseId);
      if (!we) return;
      
      // Delete all sets for this exercise
      const sets = await db.sets.where('workoutExerciseId').equals(we.uuid).toArray();
      await db.sets.bulkDelete(sets.map(s => s.id!));
      // Delete the workout exercise
      await db.workoutExercises.delete(workoutExerciseId);
      // Reorder remaining exercises
      if (exercises) {
        const remaining = exercises.filter(e => e.id !== workoutExerciseId);
        for (let i = 0; i < remaining.length; i++) {
          await db.workoutExercises.update(remaining[i].id!, { order: i, updatedAt: Date.now() });
        }
      }
    }
  };

  // Move exercise up/down
  const moveExercise = async (index: number, direction: 'up' | 'down') => {
    if (!exercises) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return;

    const ex1 = exercises[index];
    const ex2 = exercises[newIndex];

    // Swap orders
    await db.workoutExercises.update(ex1.id!, { order: newIndex, updatedAt: Date.now() });
    await db.workoutExercises.update(ex2.id!, { order: index, updatedAt: Date.now() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-bg-primary w-full h-full sm:w-[95vw] sm:h-[95vh] sm:max-w-6xl sm:max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in">
        {/* Header */}
        <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex-shrink-0 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Edit Workout</h2>
            <button 
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" 
              onClick={onClose}
            >
              <X size={24} />
            </button>
          </div>

          {/* Saved Notification */}
          {showSavedNotification && (
            <div className="absolute top-4 right-20 bg-white/95 text-accent px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-right-5 z-10">
              <CheckCircle size={18} className="text-success" />
              <span className="font-semibold text-sm">Saved</span>
            </div>
          )}

          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">Title</label>
              <input 
                className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm" 
                type="text" 
                value={title} 
                onChange={e => {
                  setTitle(e.target.value);
                  // Auto-save on blur or after delay
                }}
                onBlur={handleSaveMetadata}
                placeholder="Workout title"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">Mood</label>
              <select 
                className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm" 
                value={mood} 
                onChange={e => {
                  setMood(e.target.value as Workout['mood']);
                  handleSaveMetadata();
                }}
              >
                <option value="great">Great</option>
                <option value="good">Good</option>
                <option value="neutral">Neutral</option>
                <option value="bad">Bad</option>
                <option value="terrible">Terrible</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">Body Weight (kg)</label>
              <input 
                className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm" 
                type="number" 
                min="0" 
                step="0.01" 
                value={bodyWeight} 
                onChange={e => setBodyWeight(e.target.value)}
                onBlur={handleSaveMetadata}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">Date</label>
              <input 
                className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm" 
                type="date" 
                value={workoutDay} 
                onChange={e => {
                  setWorkoutDay(e.target.value);
                  handleSaveMetadata();
                }}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-white/80 mb-1">Notes</label>
              <textarea 
                className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm resize-none" 
                rows={2} 
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                onBlur={handleSaveMetadata}
                placeholder="Workout notes..."
              />
            </div>
          </div>
        </div>

        {/* Content - Exercises List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-primary">
          {exercises?.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="bg-bg-tertiary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Dumbbell size={36} className="text-text-tertiary" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-primary">No exercises yet</h3>
              <p className="text-text-secondary mb-6">Add your first exercise to start tracking</p>
            </div>
          )}

          {exercises?.map((we, index) => (
            <WorkoutExerciseItem 
              key={we.uuid} 
              workoutExercise={we}
              index={index}
              totalCount={exercises.length}
              onDelete={() => deleteExercise(we.id!)}
              onMoveUp={() => moveExercise(index, 'up')}
              onMoveDown={() => moveExercise(index, 'down')}
            />
          ))}

          {/* Add Buttons */}
          <div className="grid grid-cols-2 gap-3 pb-4">
            <button
              onClick={() => setIsTemplatePickerOpen(true)}
              className="py-5 px-4 rounded-2xl border-2 border-accent bg-accent/5 hover:bg-accent/10 hover:border-accent transition-all active:scale-[0.98]"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Dumbbell size={20} className="text-accent" />
                </div>
                <span className="text-sm font-bold text-accent">Add Template</span>
              </div>
            </button>
            
            <button
              onClick={() => setIsPickerOpen(true)}
              className="py-5 px-4 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-all active:scale-[0.98]"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Plus size={20} className="text-accent" />
                </div>
                <span className="text-sm font-bold text-accent">Add Exercise</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer with Close Button */}
        <div className="p-4 border-t border-border bg-bg-secondary flex-shrink-0">
          <Button fullWidth onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Modals */}
        <ExercisePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={handleAddExercise}
        />

        <TemplatePickerModal
          isOpen={isTemplatePickerOpen}
          onClose={() => setIsTemplatePickerOpen(false)}
          onSelect={handleAddTemplate}
        />
      </div>
    </div>
  );
};

// Sub-component wrapper to fetch exercise name cleanly
const WorkoutExerciseItem: React.FC<{ 
  workoutExercise: WorkoutExercise;
  index: number;
  totalCount: number;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ workoutExercise, index, totalCount, onDelete, onMoveUp, onMoveDown }) => {
  const exercise = useLiveQuery(() => db.exercises.where('uuid').equals(workoutExercise.exerciseId).first());

  if (!exercise) return <div className="animate-pulse bg-bg-tertiary h-20 rounded-lg"></div>;

  return (
    <SetList 
      workoutExercise={workoutExercise} 
      exerciseName={exercise.name} 
      isUnilateral={exercise.isUnilateral}
      index={index}
      totalCount={totalCount}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
    />
  );
};
