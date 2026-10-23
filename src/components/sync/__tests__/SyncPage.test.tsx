import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SyncPage } from '../SyncPage';
import { ToastProvider } from '../../common/Toast';
import { SCHEMA_VERSION } from '../../../services/sync/validateSnapshot';
import type { SyncSnapshot } from '../../../services/sync/types';
import { resetTestDatabase } from '../../../test-utils/db';

function snapshotWith(overrides: Partial<SyncSnapshot['data']>): File {
    const snapshot: SyncSnapshot = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: 1,
        deviceId: 'remote-device',
        data: {
            settings: [],
            exercises: [],
            workouts: [],
            workoutExercises: [],
            sets: [],
            workoutTemplates: [],
            conflictLog: [],
            ...overrides,
        },
    };
    return new File([JSON.stringify(snapshot)], 'backup.json', { type: 'application/json' });
}

function importFile(file: File): void {
    const input = screen.getByLabelText('Import JSON file');
    fireEvent.change(input, { target: { files: [file] } });
}

describe('SyncPage import feedback', () => {
    beforeEach(async () => {
        await resetTestDatabase();
        render(
            <ToastProvider>
                <SyncPage />
            </ToastProvider>,
        );
    });

    it('shows merge counts after a clean import', async () => {
        importFile(
            snapshotWith({
                exercises: [
                    { uuid: 'ex-import', name: 'Imported Press', muscleGroup: 'chest', isCustom: true, updatedAt: 10 },
                ],
            }),
        );

        expect(await screen.findByText('Data imported: 1 added, 0 updated')).toBeInTheDocument();
        expect(screen.getByText('Import and Merge successful: 1 added, 0 updated')).toBeInTheDocument();
        expect(screen.queryByText(/orphaned/i)).not.toBeInTheDocument();
    });

    /**
     * Regression: the import path discarded the MergeReport and always reported a plain
     * success, hiding rows dropped by the referential-integrity filter.
     */
    it('warns about orphaned rows skipped during import', async () => {
        importFile(
            snapshotWith({
                exercises: [
                    { uuid: 'ex-import', name: 'Imported Press', muscleGroup: 'chest', isCustom: true, updatedAt: 10 },
                ],
                workoutExercises: [
                    // Parent workout is missing from the snapshot → row must be skipped.
                    { uuid: 'we-orphan', workoutId: 'w-missing', exerciseId: 'ex-import', order: 0, updatedAt: 10 },
                ],
            }),
        );

        expect(await screen.findByText('1 orphaned row was skipped')).toBeInTheDocument();
        expect(
            screen.getByText('Import and Merge successful: 1 added, 0 updated (1 orphaned row was skipped)'),
        ).toBeInTheDocument();
    });
});
