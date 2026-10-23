import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutDetailsView } from '../WorkoutDetailsView';
import { WorkoutRepository } from '../../../data/repositories/WorkoutRepository';
import { WorkoutExerciseRepository } from '../../../data/repositories/WorkoutExerciseRepository';
import { SetRepository } from '../../../data/repositories/SetRepository';
import { ExerciseRepository } from '../../../data/repositories/ExerciseRepository';
import { resetTestDatabase } from '../../../test-utils/db';
import type { Workout } from '../../../types';

/**
 * Lets fake-indexeddb transactions commit and dexie-react-hooks deliver the re-emission
 * (same interleaving of real macrotask turns and faked-timer advances as SetItem.test.tsx).
 */
async function flushLiveQuery(): Promise<void> {
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

describe('WorkoutDetailsView collapse state', () => {
    beforeEach(async () => {
        // Fake only scheduling timers: fake-indexeddb/dexie schedule their own zero-delay
        // tasks, so the clock must keep following real time between explicit advances.
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
        await resetTestDatabase();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * Regression: the expand-all effect depended on the `workoutExercises` array identity,
     * so any live-query re-emission (e.g. the reorder performed by the edit modal) reset
     * every user-collapsed section back to expanded.
     */
    it('keeps a collapsed section collapsed when a reorder re-emits the exercise list', async () => {
        const workout: Workout = await WorkoutRepository.start({ workoutDay: '2026-01-01' });
        const squat = await ExerciseRepository.create({ name: 'Squat', muscleGroup: 'legs' });
        const lunge = await ExerciseRepository.create({ name: 'Lunge', muscleGroup: 'legs' });
        await WorkoutExerciseRepository.add(workout.uuid, squat.uuid);
        await WorkoutExerciseRepository.add(workout.uuid, lunge.uuid);
        const [squatRow, lungeRow] = await WorkoutExerciseRepository.listByWorkout(workout.uuid);
        await SetRepository.add(squatRow.uuid, { weight: 50, reps: 8 });
        await SetRepository.add(lungeRow.uuid, { weight: 70, reps: 8 });

        render(<WorkoutDetailsView workout={workout} onBack={() => undefined} />);
        await flushLiveQuery();

        // Both sections are expanded by default; each table shows its own weight.
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('70')).toBeInTheDocument();

        // Collapse the Squat section.
        fireEvent.click(screen.getByRole('button', { name: /squat/i }));
        await flushLiveQuery();
        expect(screen.queryByText('50')).not.toBeInTheDocument();
        expect(screen.getByText('70')).toBeInTheDocument();

        // Reorder — the write the edit modal performs. The live query re-emits a fresh
        // array (Lunge first now), which used to re-run the expand-all effect.
        await WorkoutExerciseRepository.move(lungeRow.uuid, 'up');
        await flushLiveQuery();

        const body = document.body.textContent ?? '';
        expect(body.indexOf('Lunge')).toBeLessThan(body.indexOf('Squat'));
        expect(screen.queryByText('50')).not.toBeInTheDocument();
    });
});
