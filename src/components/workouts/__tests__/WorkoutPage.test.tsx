import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutPage } from '../WorkoutPage';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { resetTestDatabase } from '../../../test-utils/db';

/**
 * Lets fake-indexeddb transactions commit and dexie-react-hooks deliver re-emissions
 * (same harness idea as the SetItem tests): fake-clock advances fire the `setTimeout`s
 * Dexie schedules its live-query re-runs on, while MessageChannel turns (real macrotasks,
 * not faked) let the IDB commits settle. Advances stay far below the 500 ms debounce.
 */
async function settleUntil(condition: () => boolean, maxRounds = 20): Promise<void> {
    const tick = () => new Promise<void>(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
    });
    // Each round gets its own `act` so the live-query re-emissions are committed per hop.
    for (let i = 0; i < maxRounds && !condition(); i++) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
            for (let j = 0; j < 3; j++) await tick();
        });
    }
    expect(condition()).toBe(true);
}

/** Drains pending IndexedDB commits after an unmount (no live queries left to wait for). */
async function settleDb(): Promise<void> {
    await settleUntil(() => true, 1);
}

/**
 * Drives the real flow: seed an active workout, render WorkoutPage, finish it via the
 * header button — the finished panel mounts exactly as it does in the app.
 */
async function renderFinishedPanel(): Promise<{ uuid: string; unmount: () => void }> {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-01' });
    const { unmount } = render(<WorkoutPage />);
    await settleUntil(() => screen.queryByRole('button', { name: /finish/i }) != null);
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    await settleUntil(() => screen.queryByPlaceholderText('How did you feel today?') != null);
    return { uuid: workout.uuid, unmount };
}

function typeNotes(value: string): void {
    fireEvent.change(screen.getByPlaceholderText('How did you feel today?'), { target: { value } });
}

describe('WorkoutPage finished-panel notes autosave', () => {
    beforeEach(async () => {
        // Fake only the debounce timers: fake-indexeddb/dexie schedule their own zero-delay
        // tasks, so the clock must keep following real time between explicit advances.
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * Regression: the finished panel only persisted notes on the explicit "Save to
     * History" button, violating the app rule that every change persists immediately.
     */
    it('persists typed notes once the debounce elapses, without pressing Save to History', async () => {
        const { uuid } = await renderFinishedPanel();

        typeNotes('Felt strong today');

        // Deliberately NOT clicking "Save to History" — the debounce alone must persist.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect((await WorkoutRepository.getByUuid(uuid))?.notes).toBe('Felt strong today');
    });

    /**
     * Regression: navigating away via the bottom nav (or closing the PWA) unmounts the
     * panel with the debounce still pending — the typed notes used to vanish.
     */
    it('persists typed notes when the page unmounts before the debounce fires', async () => {
        const { uuid, unmount } = await renderFinishedPanel();

        typeNotes('Felt strong today');
        unmount();
        await settleDb();

        expect((await WorkoutRepository.getByUuid(uuid))?.notes).toBe('Felt strong today');
    });

    /** The button stays a valid exit; it must still flush anything pending. */
    it('flushes pending notes when Save to History is clicked before the debounce', async () => {
        const { uuid } = await renderFinishedPanel();

        typeNotes('Quick note');
        fireEvent.click(screen.getByRole('button', { name: /save to history/i }));
        await settleDb();

        expect((await WorkoutRepository.getByUuid(uuid))?.notes).toBe('Quick note');
    });

    /** Leaving the panel untouched must not produce redundant metadata writes. */
    it('does not write metadata when the finished panel is left untouched', async () => {
        const updateMetadata = vi.spyOn(WorkoutRepository, 'updateMetadata');
        try {
            const { unmount } = await renderFinishedPanel();
            unmount();
            await settleDb();
            expect(updateMetadata).not.toHaveBeenCalled();
        } finally {
            updateMetadata.mockRestore();
        }
    });
});
