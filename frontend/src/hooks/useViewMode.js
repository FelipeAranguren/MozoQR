// frontend/src/hooks/useViewMode.js
import { useState, useEffect } from 'react';

/**
 * Hook para manejar la vista Operativa vs Ejecutiva
 */
export function useViewMode(slug) {
  const [viewMode, setViewMode] = useState('operativa');

  useEffect(() => {
    if (slug) {
      const saved = localStorage.getItem(`viewMode_${slug}`);
      if (saved && (saved === 'operativa' || saved === 'ejecutiva')) {
        setViewMode(saved);
      }
    }
  }, [slug]);

  const updateViewMode = (mode) => {
    if (mode !== 'operativa' && mode !== 'ejecutiva') return;
    setViewMode(mode);
    if (slug) {
      localStorage.setItem(`viewMode_${slug}`, mode);
    }
  };

  return {
    viewMode,
    isOperativa: viewMode === 'operativa',
    isEjecutiva: viewMode === 'ejecutiva',
    setViewMode: updateViewMode
  };
}
