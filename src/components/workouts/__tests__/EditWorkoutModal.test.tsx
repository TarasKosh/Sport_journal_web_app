import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditWorkoutModal } from '../EditWorkoutModal';
import { buildCloseFlushPatch, buildMetadataSavePatch, parseDisplayWeight } from '../../../domain/workout';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { WorkoutExerciseRepository } from '../../../data/repositories/WorkoutExerciseRepository';
import { ExerciseRepository } from '../../../data/repositories/ExerciseRepository';
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

  /**
   * Regression: the blur save aborted completely when the body weight was unparsable
   * (`if (... Number.isNaN(parsed)) return;`), so a typed title/notes/date was silently
   * dropped too. The save path now delegates to the same pure semantics: only the invalid
   * weight is skipped, the other fields persist. Pinned on the pure builder for the same
   * reason as the close-flush test above (jsdom sanitizes non-numeric values on
   * type="number" inputs to ''), then applied through the repository to prove the stored
   * weight is left untouched.
   */
  it('skips an invalid body weight on blur but still persists the other fields', async () => {
    const uuid = await seedWorkout();
    await WorkoutRepository.updateMetadata(uuid, { bodyWeight: 80 });
    const stored = (await WorkoutRepository.getByUuid(uuid))!;

    const patch = buildMetadataSavePatch(
      { title: 'Leg day', notes: '', mood: 'neutral', bodyWeight: 'not-a-number', workoutDay: stored.workoutDay },
      'kg',
      stored,
    );

    expect(patch.title).toBe('Leg day');
    expect(patch).not.toHaveProperty('bodyWeight');

    await WorkoutRepository.updateMetadata(uuid, patch);
    const after = (await WorkoutRepository.getByUuid(uuid))!;
    expect(after.title).toBe('Leg day');
    expect(after.bodyWeight).toBe(80);
  });

  /**
   * An unparsable weight must also be visible on the input (aria-invalid + danger border)
   * and an empty value must still mean "cleared", never NaN. The predicate that drives
   * both the save skip and aria-invalid is pinned here: jsdom never surfaces a
   * non-numeric string from a type="number" input, so the flagged state itself is
   * unreachable through the DOM — only the clean default is checkable there.
   */
  it('treats an unparsable body weight as invalid input and keeps valid values clean', async () => {
    const uuid = await seedWorkout();
    await WorkoutRepository.updateMetadata(uuid, { bodyWeight: 80 });
    const workout = (await WorkoutRepository.getByUuid(uuid))!;

    render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} />);

    expect(parseDisplayWeight('not-a-number')).toBeNull();
    expect(parseDisplayWeight('')).toBeUndefined();
    expect(parseDisplayWeight('80.5')).toBe(80.5);

    const weightInput = screen.getByPlaceholderText('0');
    // Number inputs report their value as a number, not a string.
    expect(weightInput).toHaveValue(80);
    expect(weightInput).not.toHaveAttribute('aria-invalid');
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

/**
 * Lets fake-indexeddb transactions commit and dexie-react-hooks deliver the exercise
 * list under fake timers (same harness idea as the WorkoutPage tests): fake-clock
 * advances fire the `setTimeout`s Dexie schedules its live-query re-runs on, while
 * MessageChannel turns (real macrotasks, not faked) let the IDB commits settle.
 */
async function settleUntil(condition: () => boolean, maxRounds = 20): Promise<void> {
  const tick = () => new Promise<void>(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
  for (let i = 0; i < maxRounds && !condition(); i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
      for (let j = 0; j < 3; j++) await tick();
    });
  }
  expect(condition()).toBe(true);
}

describe('EditWorkoutModal delete confirmation', () => {
  beforeEach(async () => {
    // Fake only the confirmation timers: fake-indexeddb/dexie schedule their own
    // zero-delay tasks, so the clock must keep following real time between advances.
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedWorkoutWithExercises(): Promise<string> {
    const uuid = await seedWorkout();
    // resetTestDatabase clears the seeded catalog, so create the exercises the join rows
    // point at — SetList renders them by name via useExerciseIndex.
    const first = await ExerciseRepository.create({ name: 'Bench Press', muscleGroup: 'chest' });
    const second = await ExerciseRepository.create({ name: 'Squat', muscleGroup: 'legs' });
    await WorkoutExerciseRepository.add(uuid, first.uuid);
    await WorkoutExerciseRepository.add(uuid, second.uuid);
    return uuid;
  }

  /**
   * Regression: `deleteExercise` armed a bare `setTimeout(..., 3000)` without tracking it,
   * so two rapid taps on different exercises left two timers running and the earlier one
   * cancelled the NEWER confirmation at its own 3 s deadline.
   */
  it("a newer confirmation is not cancelled by an older exercise's expiry timer", async () => {
    const uuid = await seedWorkoutWithExercises();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} />);

    // queryAll (never throws): at round 0 the live query has not emitted yet and an
    // getAll* would abort settleUntil before any settling round could run.
    const deleteButtons = () => screen.queryAllByLabelText('Delete exercise');
    await settleUntil(() => deleteButtons().length === 2);
    const [deleteA, deleteB] = deleteButtons();

    // t=0: A's confirmation is armed.
    fireEvent.click(deleteA);
    expect(deleteA).toHaveTextContent('Delete?');

    // t=1 s: B is confirmed too — A's pending timer must be replaced by B's.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.click(deleteB);
    expect(deleteB).toHaveTextContent('Delete?');

    // t=3 s: A's deadline passes; B (armed at t=1 s) must still be confirming.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(deleteB).toHaveTextContent('Delete?');

    // t=6 s: B's own timer still expires on schedule.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(deleteB).not.toHaveTextContent('Delete?');
  });

  /** A confirmation armed right before close must not fire on the unmounted component. */
  it('clears a pending confirmation timer on unmount without act warnings', async () => {
    const uuid = await seedWorkoutWithExercises();
    const workout = (await WorkoutRepository.getByUuid(uuid))!;
    const { unmount } = render(<EditWorkoutModal workout={workout} isOpen onClose={() => {}} />);

    // queryAll (never throws): at round 0 the live query has not emitted yet and an
    // getAll* would abort settleUntil before any settling round could run.
    const deleteButtons = () => screen.queryAllByLabelText('Delete exercise');
    await settleUntil(() => deleteButtons().length === 2);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fireEvent.click(deleteButtons()[0]);
      expect(deleteButtons()[0]).toHaveTextContent('Delete?');

      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      const actWarnings = consoleError.mock.calls.filter(args =>
        String(args[0]).includes('not wrapped in act'),
      );
      expect(actWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});
