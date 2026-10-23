import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nowMonotonic, resetMonotonicClock } from '../clock';

describe('nowMonotonic', () => {
  beforeEach(() => {
    resetMonotonicClock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMonotonicClock();
  });

  it('returns increasing timestamps even when the wall clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const first = nowMonotonic();
    const second = nowMonotonic();
    const third = nowMonotonic();

    expect(first).toBe(1_000);
    expect(second).toBe(1_001);
    expect(third).toBe(1_002);
  });

  /**
   * A clock that jumps backwards (NTP correction, manual change) must not hand out
   * timestamps older than ones already written, otherwise LWW would drop fresh edits.
   */
  it('never goes backwards when the wall clock jumps back', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const before = nowMonotonic();

    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const after = nowMonotonic();

    expect(after).toBeGreaterThan(before);
  });
});
