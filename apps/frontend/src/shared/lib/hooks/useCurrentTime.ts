import { useEffect, useState } from 'react';

export function useCurrentTime(intervalMs: number = 60_000): number {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const safeIntervalMs = Math.max(0, Math.trunc(intervalMs));

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, safeIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);

  return currentTime;
}
