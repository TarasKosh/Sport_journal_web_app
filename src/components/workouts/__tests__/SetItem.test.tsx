import { act, fireEvent, render, screen } from '@testing-library/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetItem } from '../SetItem';
import { SetRepository } from '../../../data/repositories/SetRepository';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { WorkoutExerciseRepository } from '../../../data/repositories/WorkoutExerciseRepository';
import { SettingsRepository } from '../../../data/repositories/SettingsRepository';
import { resetTestDatabase } from '../../../test-utils/db';
import { MassUnit, type SetEntry } from '../../../types';

/**
 * SetItem never reads the row itself — the parent re-renders it with a fresh `entry`
 * whenever the live query re-emits. The harness reproduces that wiring, so a repository
 * write (failure toggle, settings change) re-emits the stored row exactly like in the app.
 */
function SetItemHarness({ setId }: { setId: number }) {
    const entry = useLiveQuery(() => SetRepository.get(setId), [setId]);
    if (!entry) return null;
    return <SetItem entry={entry} index={0} />;
}

/** Fixtures go through the repository on purpose: components must not touch the database. */
async function seedSet(): Promise<SetEntry> {
    const workout = await WorkoutRepository.start({ workoutDay: '2026-01-01' });
    await WorkoutExerciseRepository.add(workout.uuid, '00000000-0000-4000-8000-000000000001');
    const [joinRow] = await WorkoutExerciseRepository.listByWorkout(workout.uuid);
    return SetRepository.add(joinRow.uuid, { weight: 50, reps: 8 });
}

/**
 * Lets fake-indexeddb transactions commit and dexie-react-hooks deliver the re-emission.
 * The emission alternates real event-loop turns (IDB commit hops) with fake-clock advances
 * (Dexie schedules live-query re-runs on the faked `setTimeout`), so the flush interleaves
 * both. The advances stay well below the 500 ms debounce — the pending edit must still be
 * pending once the resync has been delivered.
 */
async function flushLiveQuery(): Promise<void> {
    // A MessageChannel message is a real macrotask turn (it is not faked by vi.useFakeTimers).
    const tick = () => new Promise<void>(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
    });
    await act(async () => {
        for (let i = 0; i < 4; i++) {
            await vi.advanceTimersByTimeAsync(25);
            for (let j = 0; j < 3; j++) await tick();
        }
    });
}

function spinbuttons(): HTMLInputElement[] {
    return screen.getAllByRole('spinbutton') as HTMLInputElement[];
}

describe('SetItem draft resync', () => {
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
     * Regression: typing a weight (500 ms debounce pending) and then tapping the failure
     * toggle (immediate write) made the row re-emit and the render-phase resync reset the
     * draft to the stored weight — the typed value vanished from the input.
     */
    it('keeps a typed weight visible when the row re-emits, and persists it afterwards', async () => {
        const set = await seedSet();
        render(<SetItemHarness setId={set.id!} />);

        await flushLiveQuery();
        expect(spinbuttons()[0].value).toBe('50');

        // Type a new weight — scheduled with the 500 ms debounce, not yet stored.
        fireEvent.change(spinbuttons()[0], { target: { value: '100' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect((await SetRepository.get(set.id!))?.weight).toBe(50);

        // Row re-emission: the failure toggle writes immediately, resyncKey changes.
        fireEvent.click(screen.getByRole('button', { name: /success \(no failure\)/i }));
        await flushLiveQuery();

        expect(spinbuttons()[0].value).toBe('100');

        // The pending edit must still be scheduled and land in the database.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect((await SetRepository.get(set.id!))?.weight).toBe(100);
        expect(spinbuttons()[0].value).toBe('100');
    });

    /**
     * Regression: after the destructive resync, a stepper tap flushed a draft that had been
     * reset to the stored weight, so the typed weight was permanently lost (persist() skips
     * fields equal to the stored row).
     */
    it('persists the typed weight when a stepper flushes right after a resync', async () => {
        const set = await seedSet();
        render(<SetItemHarness setId={set.id!} />);

        await flushLiveQuery();
        fireEvent.change(spinbuttons()[0], { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: /success \(no failure\)/i }));
        await flushLiveQuery();
        expect(spinbuttons()[0].value).toBe('100');

        // The reps stepper flushes immediately from the draft — it must carry the weight.
        fireEvent.click(screen.getAllByRole('button', { name: 'Increment' })[1]);
        await flushLiveQuery();

        const stored = await SetRepository.get(set.id!);
        expect(stored?.reps).toBe(9);
        expect(stored?.weight).toBe(100);
    });

    it('re-derives the draft when the stored row changes and nothing is pending', async () => {
        const set = await seedSet();
        render(<SetItemHarness setId={set.id!} />);

        await flushLiveQuery();
        expect(spinbuttons()[1].value).toBe('8');

        await SetRepository.update(set.id!, { reps: 6 });
        await flushLiveQuery();

        expect(spinbuttons()[1].value).toBe('6');
    });

    it('re-derives display strings when the mass unit preference changes', async () => {
        const set = await seedSet();
        render(<SetItemHarness setId={set.id!} />);

        await flushLiveQuery();
        expect(spinbuttons()[0].value).toBe('50');

        await SettingsRepository.update({ massUnit: MassUnit.LB });
        await flushLiveQuery();

        // 50 kg shown as pounds; no pending user input, so the display fully re-derives.
        expect(spinbuttons()[0].value).toBe('110.23');
    });
});
