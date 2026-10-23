import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedWriter } from '../useDebouncedWriter';

const DELAY = 30;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('useDebouncedWriter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debounces and persists only the latest value', async () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedWriter<string>(persist, DELAY));

    act(() => {
      result.current.schedule('a');
      result.current.schedule('ab');
      result.current.schedule('abc');
    });

    expect(persist).not.toHaveBeenCalled();

    await act(async () => {
      await wait(DELAY * 3);
    });

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('abc');
  });

  /**
   * Regression: the old `useDebounce` + write-effect pair cleared its timer on unmount, so a
   * user who typed and immediately navigated away lost the last edit.
   */
  it('flushes a pending value on unmount', () => {
    const persist = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedWriter<string>(persist, 1_000));

    act(() => {
      result.current.schedule('typed-then-left');
    });
    unmount();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('typed-then-left');
  });

  it('flushes on tab hide', () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedWriter<string>(persist, 1_000));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    act(() => {
      result.current.schedule('backgrounded');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(persist).toHaveBeenCalledWith('backgrounded');
  });

  it('does not flush when the tab becomes visible again', () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedWriter<string>(persist, 1_000));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    act(() => {
      result.current.schedule('still-debouncing');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Becoming visible must not cut the debounce short; the timer still saves the value.
    expect(persist).not.toHaveBeenCalled();
  });

  it('does not persist when nothing is pending', () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedWriter<string>(persist, DELAY));

    act(() => {
      result.current.flush();
    });

    expect(persist).not.toHaveBeenCalled();
  });

  it('flushes immediately on demand (discrete actions)', () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useDebouncedWriter<string>(persist, 1_000));

    act(() => {
      result.current.schedule('stepper-tap');
      result.current.flush();
    });

    expect(persist).toHaveBeenCalledWith('stepper-tap');
  });
});
