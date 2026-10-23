import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
    /** When set, the user must type this exact text before confirming. */
    typeToConfirm?: string;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

/**
 * In-app replacement for `window.confirm` / `window.prompt`.
 * Native dialogs block the event loop, cannot be styled or translated, and are
 * untestable in jsdom — this one is a normal component.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    typeToConfirm,
    onConfirm,
    onClose,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useFocusTrap(isOpen, containerRef);

    useEffect(() => {
        if (isOpen) {
            setTyped('');
            setBusy(false);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const canConfirm = typeToConfirm == null || typed === typeToConfirm;

    const handleConfirm = async () => {
        if (!canConfirm || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
        } catch (e) {
            // Keep the dialog open so the user can retry or cancel, and surface the
            // failure instead of letting it escape as an unhandled rejection.
            console.error('ConfirmDialog: operation failed', e);
            setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? 'confirm-dialog-description' : undefined}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !busy) onClose();
            }}
            onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}
        >
            <div className="bg-bg-secondary w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-zoom-in">
                <div className="flex items-start gap-3 p-4">
                    <div
                        className={clsx(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent',
                        )}
                        aria-hidden="true"
                    >
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 id="confirm-dialog-title" className="font-bold text-text-primary">{title}</h2>
                        {description && (
                            <p id="confirm-dialog-description" className="text-sm text-text-secondary mt-1">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close dialog"
                        className="text-text-tertiary hover:text-text-primary transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <X size={18} />
                    </button>
                </div>

                {typeToConfirm && (
                    <div className="px-4 pb-2">
                        <label className="block text-xs font-semibold text-text-tertiary mb-1" htmlFor="confirm-dialog-input">
                            Type {typeToConfirm} to continue
                        </label>
                        <input
                            id="confirm-dialog-input"
                            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border focus:border-accent outline-none text-text-primary"
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                            autoComplete="off"
                        />
                    </div>
                )}

                {error && (
                    <p role="alert" className="px-4 pb-2 text-sm text-danger">
                        {error}
                    </p>
                )}

                <div className="flex gap-2 p-4 pt-2">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        fullWidth
                        disabled={!canConfirm || busy}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};
