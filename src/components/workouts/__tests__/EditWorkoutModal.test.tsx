import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditWorkoutModal } from '../EditWorkoutModal';
import { buildCloseFlushPatch } from '../../../domain/workout';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { resetTestDatabase } from '../../../test-utils/db';
import type { Workout } from '../../../types';

/**
 * Fixtures and assertions go through the repository on purpose: the component must not need
 * database access, and the ESLint boundary rule forbids importing it here.
 */
async function seedWorkout(): Promise<string> {
  const workout = await WorkoutRepository.start({ workoutDay: '2026-01-01' });
  await WorkoutRepository.updateMetadata(workout.uuid, { mood: 'neutral' });
  await WorkoutRepository.finish(workout.uuid);
  return workout.uuid;
}

/**
 * Mirrors the real callers (HistoryList / WorkoutDetailsView): closing unmounts the modal,
 * so pending blur handlers never fire for the focused input.
 */
function ModalHarness({ workout }: { workout: Workout }) {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? (
    <EditWorkoutModal workout={workout} isOpen={isOpen} onClose={() => setIsOpen(false)} />
  ) : null;
}

describe('EditWorkoutModal metadata saving', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  /**
   * Regression: `setMood(next); handleSaveMetadata();` persisted the *previous* mood, so the
   * stored value always lagged one selection behind.
   */
  it('persists the newly selected mood, not the previous one', async () => {
    const uuid = await seedWorkout();
    const onSaved = vi.fn();
    const user = userEvent.setup();

    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: /expand workout details/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'great');

    await waitFor(async () => {
      const stored = await WorkoutRepository.getByUuid(uuid);
      expect(stored?.mood).toBe('great');
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ mood: 'great' }));
  });

  /**
   * Regression: the date field had no blur handler and its immediate save used the stale
   * closure value, so changing the date never reached the database.
   */
  it('persists a changed workout date', async () => {
    const uuid = await seedWorkout();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;

    render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} />);

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-01-01');

    fireEvent.change(dateInput, { target: { value: '2026-02-03' } });

    await waitFor(async () => {
      const stored = await WorkoutRepository.getByUuid(uuid);
      expect(stored?.workoutDay).toBe('2026-02-03');
    });
  });

  it('persists notes typed in the metadata form', async () => {
    const uuid = await seedWorkout();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    const user = userEvent.setup();

    render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} />);

    const notes = screen.getByPlaceholderText('Workout notes...');
    await user.type(notes, 'Solid session');
    fireEvent.blur(notes);

    await waitFor(async () => {
      const stored = await WorkoutRepository.getByUuid(uuid);
      expect(stored?.notes).toBe('Solid session');
    });
  });

  /**
   * Regression: the metadata inputs only saved on blur, but Escape/backdrop close unmounts
   * the form before the pending blur fires — "type a title, press Escape" silently lost
   * the edit.
   */
  it('persists a title typed right before the modal is closed with Escape', async () => {
    const uuid = await seedWorkout();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    const user = userEvent.setup();

    render(<ModalHarness workout={workout} />);

    await user.type(screen.getByPlaceholderText('Workout title'), 'Leg day');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(async () => {
      const stored = await WorkoutRepository.getByUuid(uuid);
      expect(stored?.title).toBe('Leg day');
    });
  });

  /**
   * An unparsable body weight must not eat the other pending fields on close: only the
   * invalid weight is skipped (never saved as NaN), the valid ones still flush. A browser
   * rarely surfaces such a string from a type="number" input (jsdom never does), so the
   * rule is pinned directly on the pure patch builder the unmount flush uses.
   */
  it('skips an invalid body weight on close but still persists other pending edits', async () => {
    const uuid = await seedWorkout();
    await WorkoutRepository.updateMetadata(uuid, { bodyWeight: 80 });
    const stored = (await WorkoutRepository.getByUuid(uuid))!;
    const day = stored.workoutDay;

    const patch = buildCloseFlushPatch(
      { title: 'Leg day', notes: '', mood: 'neutral', bodyWeight: 'not-a-number', workoutDay: day },
      { title: '', notes: '', mood: 'neutral', bodyWeight: '80', workoutDay: day },
      'kg',
      stored,
    );

    expect(patch).toEqual({ title: 'Leg day' });
  });

  /** Closing without touching any field must not produce a redundant metadata write. */
  it('does not write metadata when the modal closes without edits', async () => {
    const uuid = await seedWorkout();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    const updateMetadata = vi.spyOn(WorkoutRepository, 'updateMetadata');

    render(<ModalHarness workout={workout} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    // Give the fire-and-forget close flush a chance to (wrongly) fire.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(updateMetadata).not.toHaveBeenCalled();
    updateMetadata.mockRestore();
  });

  it('saving metadata does not close the modal by itself', async () => {
    const uuid = await seedWorkout();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<EditWorkoutModal workout={workout} isOpen onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /expand workout details/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'good');

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
