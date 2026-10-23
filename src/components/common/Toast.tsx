import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ToastContext, type ToastKind } from './toastContext';

interface ToastItem {
    id: number;
    message: string;
    kind: ToastKind;
}

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<ToastItem[]>([]);

    const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
        const id = nextId++;
        setItems((prev) => [...prev, { id, message, kind }]);
        window.setTimeout(() => {
            setItems((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(92vw,24rem)] pointer-events-none">
                {items.map((t) => (
                    <div
                        key={t.id}
                        role={t.kind === 'error' ? 'alert' : 'status'}
                        aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
                        className={clsx(
                            'pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg border animate-slide-up flex items-start justify-between gap-3',
                            t.kind === 'success' && 'bg-success/15 border-success/40 text-text-primary',
                            t.kind === 'warning' && 'bg-warning/15 border-warning/40 text-warning',
                            t.kind === 'error' && 'bg-danger/15 border-danger/40 text-danger',
                            t.kind === 'info' && 'bg-bg-secondary border-border text-text-primary',
                        )}
                    >
                        <span>{t.message}</span>
                        <button
                            type="button"
                            className="text-xs opacity-70 hover:opacity-100 shrink-0"
                            aria-label="Dismiss"
                            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
