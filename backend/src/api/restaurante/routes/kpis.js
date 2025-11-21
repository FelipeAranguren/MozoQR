// backend/src/api/restaurante/routes/kpis.js
'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/restaurants/:slug/kpis',
      handler: 'kpis.today',
      config: {
        auth: true,
        policies: ['global::by-restaurant'],
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/export',
      handler: 'kpis.exportCsv',
      config: {
        auth: true,
        policies: ['global::by-restaurant'],
      },
    },
    // Temporal: agregar ruta de menus aquí para debug
    {
      method: 'GET',
      path: '/restaurants/:slug/menus',
      handler: 'menus.find',
      config: {
        auth: false,
        policies: ['global::by-restaurant'],
      },
    },
  ],
};
