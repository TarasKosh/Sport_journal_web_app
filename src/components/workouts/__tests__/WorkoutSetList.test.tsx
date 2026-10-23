import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SetList } from '../WorkoutSetList';
import { resetTestDatabase } from '../../../test-utils/db';
import type { Exercise, WorkoutExercise } from '../../../types';

/**
 * `exercise` arrives after the first render in the app (it resolves from the shared
 * `useExerciseIndex` live query), so these tests rerender the same SetList instance with
 * the prop appearing late — exactly what the parent does.
 */
const workoutExercise: WorkoutExercise = {
    uuid: '00000000-0000-4000-8000-0000000000aa',
    workoutId: '00000000-0000-4000-8000-0000000000bb',
    exerciseId: '00000000-0000-4000-8000-0000000000cc',
    order: 0,
    updatedAt: 0,
};

function makeExercise(isUnilateral: boolean): Exercise {
    return {
        uuid: workoutExercise.exerciseId,
        name: 'Bulgarian Split Squat',
        muscleGroup: 'legs',
        isCustom: true,
        updatedAt: 0,
        isUnilateral,
    };
}

function lrSwitch(): HTMLElement {
    // The L/R toggle is the only button whose label starts with "L/R".
    return screen.getByRole('button', { name: /^L\/R/ });
}

describe('SetList unilateral default', () => {
    beforeEach(async () => {
        await resetTestDatabase();
    });

    /**
     * Regression: the state initializer captured `exercise?.isUnilateral` while the
     * exercise was still undefined, so a late-resolving unilateral exercise never turned
     * on side tracking.
     */
    it('applies the unilateral default when the exercise resolves after first render', () => {
        const { rerender } = render(
            <SetList workoutExercise={workoutExercise} />,
        );
        expect(lrSwitch()).toHaveTextContent('L/R Off');

        rerender(<SetList workoutExercise={workoutExercise} exercise={makeExercise(true)} />);

        expect(lrSwitch()).toHaveTextContent('L/R Active');
    });

    it('keeps an explicit user toggle when the exercise arrives afterwards', () => {
        const { rerender } = render(
            <SetList workoutExercise={workoutExercise} />,
        );
        // The user opts into side tracking before the exercise (unilateral: false) loads.
        fireEvent.click(lrSwitch());
        expect(lrSwitch()).toHaveTextContent('L/R Active');

        rerender(<SetList workoutExercise={workoutExercise} exercise={makeExercise(false)} />);

        expect(lrSwitch()).toHaveTextContent('L/R Active');
    });
});
