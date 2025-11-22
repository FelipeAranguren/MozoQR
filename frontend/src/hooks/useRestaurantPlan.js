// frontend/src/hooks/useRestaurantPlan.js
import { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * Hook para obtener el plan del restaurante y datos relacionados
 * @param {string} slug - Slug del restaurante
 * @returns {Object} { plan, loading, restaurant, error }
 */
export function useRestaurantPlan(slug) {
  const [plan, setPlan] = useState('BASIC');
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    async function fetchRestaurantPlan() {
      try {
        setLoading(true);
        setError(null);

        // Intentar obtener desde el endpoint namespaced que ya tiene el plan
        try {
          const { data } = await api.get(`/restaurants/${slug}/menus`);
          if (data?.data?.restaurant) {
            const planRaw = data.data.restaurant.plan || data.data.restaurant.Suscripcion || 'basic';
            
            // Mapear planes de Strapi (basic, pro, ultra) a frontend (BASIC, PRO, ULTRA)
            const planMap = {
              'basic': 'BASIC',
              'pro': 'PRO',
              'ultra': 'ULTRA'
            };
            
            const mappedPlan = planMap[planRaw.toLowerCase()] || 'BASIC';
            setPlan(mappedPlan);
            setRestaurant({
              id: data.data.restaurant.id,
              name: data.data.restaurant.name,
              slug: data.data.restaurant.slug,
              plan: mappedPlan
            });
            setLoading(false);
            return;
          }
        } catch (e) {
          // Si falla, intentar directamente desde restaurantes
        }

        // Fallback: obtener directamente desde /restaurantes
        const res = await api.get(`/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id&fields[1]=name&fields[2]=slug&fields[3]=Suscripcion`);
        const data = res?.data?.data?.[0];
        
        if (data) {
          const attr = data.attributes || data;
          const planRaw = attr.Suscripcion || attr.suscripcion || 'basic';
          
          // Mapear planes de Strapi (basic, pro, ultra) a frontend (BASIC, PRO, ULTRA)
          // Eliminamos PLUS ya que no existe en Strapi
          const planMap = {
            'basic': 'BASIC',
            'pro': 'PRO',
            'ultra': 'ULTRA'
          };
          
          const mappedPlan = planMap[planRaw.toLowerCase()] || 'BASIC';
          setPlan(mappedPlan);
          setRestaurant({
            id: data.id,
            name: attr.name || data.name,
            slug: attr.slug || data.slug,
            plan: mappedPlan
          });
        } else {
          setPlan('BASIC');
        }
      } catch (err) {
        console.error('Error fetching restaurant plan:', err);
        setError(err.message);
        setPlan('BASIC');
      } finally {
        setLoading(false);
      }
    }

    fetchRestaurantPlan();
  }, [slug]);

  return {
    plan,           // 'BASIC' | 'PRO' | 'ULTRA' (mapeado desde Strapi: basic, pro, ultra)
    restaurant,
    loading,
    error,
    isBasic: plan === 'BASIC',
    isPro: plan === 'PRO' || plan === 'ULTRA',
    isUltra: plan === 'ULTRA'
  };
}

