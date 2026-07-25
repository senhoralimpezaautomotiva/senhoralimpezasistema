import { useCallback, useEffect, useRef } from 'react';

export function useManagedTimeout() {
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  return useCallback((callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delayMs);
    timers.current.add(timer);
    return timer;
  }, []);
}
