import { useState, useEffect } from 'react';
import { getUsdArsRate, FALLBACK_USD_ARS } from '../api/exchangeRate';

/**
 * Hook para obtener el tipo de cambio USD → ARS usado en precios.
 * @returns {{ rate: number, loading: boolean, error: string | null }}
 */
export function useExchangeRate() {
  const [rate, setRate] = useState(FALLBACK_USD_ARS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRate() {
      setLoading(true);
      setError(null);
      try {
        const value = await getUsdArsRate();
        if (!cancelled) {
          if (value != null) {
            setRate(value);
          } else {
            setRate(FALLBACK_USD_ARS);
            setError('No se pudo obtener el tipo de cambio. Se usa valor de referencia.');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setRate(FALLBACK_USD_ARS);
          setError('Error al obtener el tipo de cambio.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRate();
    return () => { cancelled = true; };
  }, []);

  return { rate, loading, error };
}
