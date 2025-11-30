// backend/src/api/owner-comment/routes/owner.ts
/**
 * Rutas personalizadas para que los dueños puedan crear comentarios
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/owner-comments/owner/create',
      handler: 'api::owner-comment.owner.create',
      config: {
        auth: {}, // requiere autenticación
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/owner-comments/owner/:id/archive',
      handler: 'api::owner-comment.owner.toggleArchive',
      config: {
        auth: {}, // requiere autenticación
        policies: [],
        middlewares: [],
      },
    },
  ],
};

