import React, { useState } from 'react';
import type { Workout } from '../../types';
import { db } from '../../db/db';
import { Button } from '../common/Button';

interface EditWorkoutModalProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: Workout) => void;
}

/**
 * Модальное окно для редактирования завершённой тренировки:
 * Позволяет изменять основные параметры (тайтл, настроение, заметки, массу тела, дату)
 */
export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({ workout, isOpen, onClose, onSaved }) => {
  // Локальные стейты для редактируемых полей: начальные значения из workout
  const [title, setTitle] = useState(workout.title || '');
  const [notes, setNotes] = useState(workout.notes || '');
  const [mood, setMood] = useState(workout.mood || 'neutral');
  const [bodyWeight, setBodyWeight] = useState(workout.bodyWeight?.toString() || '');
  const [workoutDay, setWorkoutDay] = useState(workout.workoutDay || '');
  const [loading, setLoading] = useState(false);

  // Функция сохранения изменений
  const handleSave = async () => {
    setLoading(true);
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
      onClose();
    } catch (e) {
      alert('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-bg-primary w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in">
        <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Edit Workout</h2>
          <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" onClick={onClose}>
            <span aria-label="Close">×</span>
          </button>
        </div>
        <form className="p-5 space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <label className="block text-sm font-bold">
            Title
            <input className="w-full px-3 py-2 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none mt-1" type="text" value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Notes
            <textarea className="w-full px-3 py-2 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none mt-1" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Mood
            <select className="w-full px-3 py-2 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none mt-1" value={mood} onChange={e => setMood(e.target.value as Workout['mood'])}>
              <option value="great">Great</option>
              <option value="good">Good</option>
              <option value="neutral">Neutral</option>
              <option value="bad">Bad</option>
              <option value="terrible">Terrible</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Body Weight (kg)
            <input className="w-full px-3 py-2 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none mt-1" type="number" min="0" step="0.01" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Date
            <input className="w-full px-3 py-2 rounded-xl bg-bg-secondary border-2 border-border focus:border-accent/60 outline-none mt-1" type="date" value={workoutDay} onChange={e => setWorkoutDay(e.target.value)} />
          </label>
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" fullWidth loading={loading}>Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

