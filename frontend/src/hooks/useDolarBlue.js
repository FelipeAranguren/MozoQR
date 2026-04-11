import { useState, useEffect } from 'react';

const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares/blue';
const FALLBACK_VENTA = 1000;

/**
 * Hook que consulta la cotización del dólar blue (venta) desde Dolar API.
 * @returns {{ blueVenta: number, loading: boolean, error: string | null }}
 *   - blueVenta: valor de venta del blue (o FALLBACK_VENTA si falla la API)
 *   - loading: true mientras se obtiene el valor
 *   - error: mensaje si hubo error (aun así se usa el fallback)
 */
export function useDolarBlue() {
  const [blueVenta, setBlueVenta] = useState(FALLBACK_VENTA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBlue() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(DOLAR_API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const venta = Number(data?.venta);
        if (!cancelled && Number.isFinite(venta) && venta > 0) {
          setBlueVenta(venta);
        } else if (!cancelled) {
          setBlueVenta(FALLBACK_VENTA);
          setError('Valor de venta no válido');
        }
      } catch (e) {
        if (!cancelled) {
          setBlueVenta(FALLBACK_VENTA);
          setError(e?.message || 'Error al obtener cotización');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBlue();
    return () => { cancelled = true; };
  }, []);

  return { blueVenta, loading, error };
}
