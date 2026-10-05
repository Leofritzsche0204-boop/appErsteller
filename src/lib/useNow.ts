import { useEffect, useState } from 'react';

/** Aktuelle Zeit (ms), die sich regelmäßig aktualisiert – z. B. für Countdowns. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
