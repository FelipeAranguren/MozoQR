export default {
  routes: [
    {
      method: 'POST',
      path: '/restaurants/:slug/caja/abrir',
      handler: 'custom-caja.abrir',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/caja/cerrar',
      handler: 'custom-caja.cerrar',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/caja/actual',
      handler: 'custom-caja.actual',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/caja/historial',
      handler: 'custom-caja.historial',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/caja/movimiento',
      handler: 'custom-caja.movimiento',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/caja/movimientos',
      handler: 'custom-caja.movimientos',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/caja/resumen',
      handler: 'custom-caja.resumen',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
  ],
};
