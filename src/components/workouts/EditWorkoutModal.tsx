import React, { useRef, useState, useEffect } from 'react';
import type { MassUnit, Workout } from '../../types';
import { Button } from '../common/Button';
import { X, Plus, Dumbbell, CheckCircle, ChevronDown } from 'lucide-react';
import { ExercisePickerModal } from './ExercisePickerModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { SetList } from './WorkoutSetList';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSettings } from '../../hooks/useSettings';
import { useWorkoutEditor } from '../../hooks/useWorkoutEditor';
import { WorkoutRepository } from '../../data/repositories/WorkoutRepository';
import { displayToKg, kgToDisplay, massUnitLabel } from '../../utils/mass';

interface EditWorkoutModalProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  /** Called after every successful metadata save. Closing the modal is the caller's choice. */
  onSaved?: (updated: Workout) => void;
}

type MetadataDraft = {
  title: string;
  notes: string;
  mood: NonNullable<Workout['mood']>;
  bodyWeight: string;
  workoutDay: string;
};

interface MetadataFormProps {
  workout: Workout;
  massUnit: MassUnit;
  title: string;
  onTitleChange: (value: string) => void;
  onSaved: (updated: Workout) => void;
}

/**
 * Metadata editor, mounted per workout (`key={workout.uuid}`) so field state initialises
 * from props and never has to be synchronised with an effect.
 *
 * Bug fix: the previous implementation called `setMood(next); handleSaveMetadata();` — the
 * save closure still held the *previous* mood, so the selection was persisted one step
 * behind, and the date field (which had no blur handler) was never saved at all. Saves now
 * receive explicit overrides, so the value being persisted is the value the user picked.
 */
const MetadataForm: React.FC<MetadataFormProps> = ({ workout, massUnit, title, onTitleChange, onSaved }) => {
  const [notes, setNotes] = useState(workout.notes || '');
  const [mood, setMood] = useState<NonNullable<Workout['mood']>>(workout.mood || 'neutral');
  const [bodyWeight, setBodyWeight] = useState(
    workout.bodyWeight != null ? String(kgToDisplay(workout.bodyWeight, massUnit)) : '',
  );
  const [workoutDay, setWorkoutDay] = useState(workout.workoutDay || '');

  const save = async (overrides: Partial<MetadataDraft> = {}) => {
    const fields: MetadataDraft = { title, notes, mood, bodyWeight, workoutDay, ...overrides };
    const parsedDisplay = fields.bodyWeight !== '' ? parseFloat(fields.bodyWeight) : undefined;
    if (fields.bodyWeight !== '' && Number.isNaN(parsedDisplay)) return;

    const bodyWeightKg = parsedDisplay != null ? displayToKg(parsedDisplay, massUnit) : undefined;
    const day = fields.workoutDay.trim() || workout.workoutDay;
    const trimmedTitle = fields.title.trim() || undefined;
    const trimmedNotes = fields.notes.trim() || undefined;

    try {
      await WorkoutRepository.updateMetadata(workout.uuid, {
        title: trimmedTitle,
        notes: trimmedNotes,
        mood: fields.mood,
        bodyWeight: bodyWeightKg,
        workoutDay: day,
      });
      onSaved({ ...workout, title: trimmedTitle, notes: trimmedNotes, mood: fields.mood, bodyWeight: bodyWeightKg, workoutDay: day });
    } catch (e) {
      console.error('Failed to save workout metadata', e);
    }
  };

  return (
    <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-semibold text-white/80 mb-1">Title</label>
        <input
          className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm"
          type="text"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          onBlur={() => save()}
          placeholder="Workout title"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/80 mb-1">Mood</label>
        <select
          className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm"
          value={mood}
          onChange={e => {
            const next = e.target.value as NonNullable<Workout['mood']>;
            setMood(next);
            void save({ mood: next });
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
        <label className="block text-xs font-semibold text-white/80 mb-1">
          Body Weight ({massUnitLabel(massUnit).toLowerCase()})
        </label>
        <input
          className="w-full px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border-2 border-white/30 focus:border-white/50 focus:outline-none text-sm"
          type="number"
          min="0"
          step="0.01"
          value={bodyWeight}
          onChange={e => setBodyWeight(e.target.value)}
          onBlur={() => save()}
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
            const next = e.target.value;
            setWorkoutDay(next);
            void save({ workoutDay: next });
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
          onBlur={() => save()}
          placeholder="Workout notes..."
        />
      </div>
    </div>
  );
};

/**
 * Full-featured modal for editing completed workouts:
 * - Edit metadata (title, notes, mood, bodyWeight, date)
 * - Add/remove/reorder exercises
 * - Edit sets and their content (weight, reps, RPE, etc.)
 */
export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({ workout, isOpen, onClose, onSaved }) => {
  const settings = useSettings();
  const { workoutExercises, exerciseIndex, addExercise, addTemplate, moveExercise, removeExercise } =
    useWorkoutEditor(workout.uuid);

  const [title, setTitle] = useState(workout.title || '');
  const [loadedUuid, setLoadedUuid] = useState(workout.uuid);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [confirmDeleteExerciseUuid, setConfirmDeleteExerciseUuid] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useFocusTrap(isOpen, containerRef);

  // The caller may swap the workout prop without unmounting; re-seed the header title then.
  if (loadedUuid !== workout.uuid) {
    setLoadedUuid(workout.uuid);
    setTitle(workout.title || '');
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleSaved = (updated: Workout) => {
    setShowSavedNotification(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setShowSavedNotification(false);
    }, 2000);
    onSaved?.(updated);
  };

  const deleteExercise = async (workoutExerciseUuid: string) => {
    if (confirmDeleteExerciseUuid !== workoutExerciseUuid) {
      setConfirmDeleteExerciseUuid(workoutExerciseUuid);
      setTimeout(() => setConfirmDeleteExerciseUuid(null), 3000);
      return;
    }
    await removeExercise(workoutExerciseUuid);
    setConfirmDeleteExerciseUuid(null);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-workout-title"
      aria-describedby="edit-workout-desc"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <span id="edit-workout-desc" className="sr-only">Edit workout details, add or remove exercises, and modify sets.</span>
      <div className="bg-bg-primary w-full h-full sm:w-[95vw] sm:h-[95vh] sm:max-w-6xl sm:max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-fade-in">

        {/* ── Collapsible Header ── */}
        <div className="bg-gradient-to-br from-accent to-accent-hover text-white flex-shrink-0 relative">

          {/* Always-visible title row */}
          <div className="flex items-center justify-between px-4 h-14">
            {/* Chevron toggle */}
            <button
              className="flex items-center gap-2 min-w-0 flex-1 text-left group"
              onClick={() => setIsHeaderExpanded(prev => !prev)}
              aria-expanded={isHeaderExpanded}
              aria-label={isHeaderExpanded ? 'Collapse workout details' : 'Expand workout details'}
            >
              <ChevronDown
                size={20}
                className="flex-shrink-0 text-white/80 transition-transform duration-300"
                style={{ transform: isHeaderExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              <h2 id="edit-workout-title" className="text-lg font-bold truncate">
                {title.trim() || 'Edit Workout'}
              </h2>
            </button>

            {/* Saved badge + close */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {showSavedNotification && (
                <div className="bg-white/95 text-accent px-3 py-1 rounded-lg flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle size={14} className="text-success" />
                  <span className="font-semibold text-xs">Saved</span>
                </div>
              )}
              <button
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Expandable metadata form */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: isHeaderExpanded ? '420px' : '0px' }}
          >
            <MetadataForm
              key={workout.uuid}
              workout={workout}
              massUnit={settings.massUnit}
              title={title}
              onTitleChange={setTitle}
              onSaved={handleSaved}
            />
          </div>
        </div>

        {/* Content - Exercises List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-primary">
          {workoutExercises?.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="bg-bg-tertiary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Dumbbell size={36} className="text-text-tertiary" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-primary">No exercises yet</h3>
              <p className="text-text-secondary mb-6">Add your first exercise to start tracking</p>
            </div>
          )}

          {workoutExercises?.map((workoutExercise, index) => (
            <SetList
              key={workoutExercise.uuid}
              workoutExercise={workoutExercise}
              exercise={exerciseIndex.get(workoutExercise.exerciseId)}
              index={index}
              totalCount={workoutExercises.length}
              onDelete={deleteExercise}
              isConfirmingDelete={confirmDeleteExerciseUuid === workoutExercise.uuid}
              onMove={moveExercise}
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
          onSelect={async (exerciseUuid) => {
            await addExercise(exerciseUuid);
            setIsPickerOpen(false);
          }}
        />

        <TemplatePickerModal
          isOpen={isTemplatePickerOpen}
          onClose={() => setIsTemplatePickerOpen(false)}
          onSelect={async (templateUuid) => {
            await addTemplate(templateUuid);
            setIsTemplatePickerOpen(false);
          }}
        />
      </div>
    </div>
  );
};
