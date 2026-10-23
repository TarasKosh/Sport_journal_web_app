import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog async handling', () => {
    /**
     * Regression: `handleConfirm` had try/finally without catch, so a rejecting
     * `onConfirm` escaped as an unhandled rejection with zero user feedback.
     */
    it('keeps the dialog open and shows the error when onConfirm rejects', async () => {
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                isOpen
                title="Discard this workout?"
                confirmLabel="Discard"
                onConfirm={() => Promise.reject(new Error('IndexedDB write failed'))}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('IndexedDB write failed');
        // The dialog must stay open so the user can retry or cancel.
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    /**
     * Regression: Escape and backdrop clicks dismissed the dialog while the confirm
     * operation was still in flight, racing the caller's own close.
     */
    it('ignores Escape and backdrop clicks while a confirm operation is busy', async () => {
        let resolveOperation!: () => void;
        const onConfirm = () => new Promise<void>(resolve => { resolveOperation = resolve; });
        const onClose = vi.fn();
        render(
            <ConfirmDialog
                isOpen
                title="Delete workout"
                confirmLabel="Delete"
                onConfirm={onConfirm}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        // Busy: implicit dismissal is suppressed and the explicit cancel is disabled.
        fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
        fireEvent.click(screen.getByRole('alertdialog'));
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

        // Once the operation settles, dismissal works again.
        resolveOperation();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
        fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    /** The success path is unchanged: the dialog closes through the caller, not itself. */
    it('still closes through the caller when onConfirm resolves', async () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn(async () => { onClose(); });
        render(
            <ConfirmDialog
                isOpen
                title="Delete workout"
                confirmLabel="Delete"
                onConfirm={onConfirm}
                onClose={onClose}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
