// frontend/src/hooks/useRestaurantes.js
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

// Helper para obtener token
function getToken() {
  return localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt') || null;
}

/**
 * Hook para obtener todos los restaurantes desde Strapi
 * @returns {Object} { restaurantes, loading, error, refetch }
 */
export function useRestaurantes() {
  const [restaurantes, setRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRestaurantes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Obtener todos los restaurantes con populate
      const res = await axios.get(`${API_URL}/restaurantes?populate=*`, { headers });

      // Mapear los datos de Strapi a un formato más usable
      const data = res.data?.data || [];
      const base = API_URL.replace('/api', '');
      
      const mappedRestaurantes = data.map((r) => {
        // Strapi v4 puede tener datos en r.attributes o directamente en r
        const attr = r.attributes || r;
        
        // Construir URL del logo si existe (similar a Restaurants.jsx)
        let logoUrl = null;
        if (attr.logo?.data) {
          const logoData = attr.logo.data;
          const logo = logoData.attributes || logoData;
          const urlRel = 
            logo.formats?.small?.url ||
            logo.formats?.thumbnail?.url ||
            logo.url ||
            null;
          logoUrl = urlRel ? (urlRel.startsWith('http') ? urlRel : `${base}${urlRel}`) : null;
        }

        return {
          id: r.id,
          name: attr.name || r.name || `Restaurante ${r.id}`,
          slug: attr.slug || r.slug || String(r.id),
          suscripcion: attr.Suscripcion || attr.suscripcion || 'basic',
          mp_access_token: attr.mp_access_token || null,
          mp_public_key: attr.mp_public_key || null,
          cbu: attr.cbu || null,
          cuenta_bancaria: attr.cuenta_bancaria || null,
          logo: logoUrl,
          mesas: attr.mesas?.data?.length || (Array.isArray(attr.mesas) ? attr.mesas.length : 0) || 0,
          mesa_sesions: attr.mesa_sesions?.data?.length || (Array.isArray(attr.mesa_sesions) ? attr.mesa_sesions.length : 0) || 0,
          restaurant_members: attr.restaurant_members?.data?.length || (Array.isArray(attr.restaurant_members) ? attr.restaurant_members.length : 0) || 0,
          createdAt: attr.createdAt || null,
          updatedAt: attr.updatedAt || null,
        };
      });

      setRestaurantes(mappedRestaurantes);
    } catch (err) {
      console.error('Error fetching restaurantes:', err);
      setError(err.response?.data?.error?.message || err.message || 'Error al cargar restaurantes');
      setRestaurantes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurantes();
  }, []);

  return {
    restaurantes,
    loading,
    error,
    refetch: fetchRestaurantes,
  };
}

