export default {
  routes: [
    {
      method: 'GET',
      path: '/notificaciones/pagos',
      handler: 'notificaciones.pagos',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/notificaciones/pagos/stream',
      handler: 'notificaciones.pagosStream',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};

