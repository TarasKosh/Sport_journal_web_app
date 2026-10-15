import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounced writer with an explicit flush.
 *
 * The previous approach (`useDebounce` + a write effect per field) lost the last edits
 * whenever the component unmounted first — the debounce timer was cleared in cleanup and
 * the pending value never reached IndexedDB. This hook persists pending work on unmount,
 * on tab hide and on `pagehide`, and exposes `flush` so a discrete action (a stepper tap,
 * a toggle, a blur) can save immediately.
 */
export function useDebouncedWriter<T>(
    persist: (value: T) => void | Promise<void>,
    delay = 500,
) {
    const persistRef = useRef(persist);
    useEffect(() => {
        persistRef.current = persist;
    }, [persist]);

    const valueRef = useRef<T | null>(null);
    const pendingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const cancelTimer = () => {
        if (timerRef.current !== undefined) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }
    };

    const flush = useCallback(() => {
        if (!pendingRef.current) return;
        pendingRef.current = false;
        cancelTimer();
        const value = valueRef.current as T;
        void persistRef.current(value);
    }, []);

    const schedule = useCallback((value: T) => {
        valueRef.current = value;
        pendingRef.current = true;
        cancelTimer();
        timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            pendingRef.current = false;
            void persistRef.current(value);
        }, delay);
    }, [delay]);

    useEffect(() => {
        const handleHide = () => flush();
        document.addEventListener('visibilitychange', handleHide);
        window.addEventListener('pagehide', handleHide);
        return () => {
            document.removeEventListener('visibilitychange', handleHide);
            window.removeEventListener('pagehide', handleHide);
            // Unmount flush: never drop the user's last keystrokes.
            flush();
        };
    }, [flush]);

    useEffect(() => cancelTimer, []);

    return { schedule, flush };
}
