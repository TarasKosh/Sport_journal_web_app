const STORAGE_KEY = 'sj:lastWriteTs';

let memoryClock = 0;

function readStored(): number {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw == null ? 0 : Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return memoryClock;
    }
}

function writeStored(value: number): void {
    memoryClock = value;
    try {
        localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
        // Storage may be unavailable (private mode / disabled cookies): the in-memory
        // fallback still guarantees monotonicity within the session.
    }
}

/**
 * Wall-clock timestamp that is strictly increasing per device.
 *
 * LWW sync compares `updatedAt` values, so a non-monotonic clock (user changes the
 * system time, NTP correction, daylight shift) could make a fresh edit lose against an
 * older remote record — or produce equal timestamps that never converge.
 * Every write path must use this instead of `Date.now()`.
 */
export function nowMonotonic(): number {
    const now = Date.now();
    const last = Math.max(readStored(), memoryClock);
    const next = now > last ? now : last + 1;
    writeStored(next);
    return next;
}

/** Test helper: resets the stored high-water mark. */
export function resetMonotonicClock(): void {
    memoryClock = 0;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
