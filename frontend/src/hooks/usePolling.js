// frontend/src/hooks/usePolling.js
import { useEffect, useRef, useState } from 'react';

/**
 * Generic polling hook
 * @param {Function} fetcher async () => any
 * @param {number} ms interval in ms (default 4500)
 * @returns [data, error, tick]
 */
export default function usePolling(fetcher, ms = 4500) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const mounted = useRef(false);

  async function run() {
    try {
      const res = await fetcher();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    mounted.current = true;
    run(); // first
    timer.current = setInterval(run, ms);
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [ms]);

  return [data, error, run];
}
