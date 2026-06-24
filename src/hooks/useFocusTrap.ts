import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.closest('[inert]')
    ) as HTMLElement[];
}

let activeTrapCount = 0;

export function useFocusTrap(
    isActive: boolean,
    containerRef: RefObject<HTMLElement | null>
) {
    const prevRef = useRef<HTMLElement | null>(null);
    const trapIdRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;
        const container = containerRef.current;
        if (!container) return;

        activeTrapCount++;
        trapIdRef.current = activeTrapCount;

        prevRef.current = document.activeElement as HTMLElement;

        const els = getFocusable(container);
        (els.length > 0 ? els[0] : container).focus();

        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Tab') return;
            if (trapIdRef.current !== activeTrapCount) return;
            const container = containerRef.current;
            if (!container) return;
            const els = getFocusable(container);
            if (!els.length) return;
            const first = els[0];
            const last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            activeTrapCount--;
            prevRef.current?.focus();
        };
    }, [isActive, containerRef]);
}
