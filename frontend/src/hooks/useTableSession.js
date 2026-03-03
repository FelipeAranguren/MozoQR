// src/hooks/useTableSession.js
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const TS_CURRENT_KEY = 'ts:current';
const makeTSKey = (slug, table) => `ts:${slug}:${table}`;

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ts_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export default function useTableSession() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const tableParam = searchParams.get('t');
  const table = tableParam ? Number(tableParam) : null;

  // Calculamos el localStorage key de esta mesa
  const tsKey = useMemo(() => {
    if (!slug || !table) return null;
    return makeTSKey(slug, table);
  }, [slug, table]);

  // Leemos o creamos el tableSessionId
  const tableSessionId = useMemo(() => {
    if (!tsKey) return null;
    let ts = localStorage.getItem(tsKey);
    if (!ts) {
      ts = randomId();
      localStorage.setItem(tsKey, ts);
    }
    return ts;
  }, [tsKey]);

  // Publicamos la "sesión actual" para que otros (CartContext) sepan el scope
  useEffect(() => {
    if (tableSessionId) {
      localStorage.setItem(TS_CURRENT_KEY, tableSessionId);
    } else {
      localStorage.removeItem(TS_CURRENT_KEY);
    }
    window.dispatchEvent(new Event('ts-changed'));
  }, [tableSessionId]);

  return { slug, table, tableSessionId };
}