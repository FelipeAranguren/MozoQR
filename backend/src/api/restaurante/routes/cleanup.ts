export default {
  routes: [
    {
      method: 'POST',
      path: '/restaurants/:slug/cleanup/old-sessions',
      handler: 'cleanup.cleanOldSessions',
      config: {
        auth: false, // No requiere autenticación estricta (el controlador valida el slug)
        policies: [], // El controlador valida el restaurante directamente
      },
    },
  ],
};

