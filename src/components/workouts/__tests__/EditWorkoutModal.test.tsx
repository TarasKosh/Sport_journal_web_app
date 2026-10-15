import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditWorkoutModal } from '../EditWorkoutModal';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { resetTestDatabase } from '../../../test-utils/db';

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
