'use strict';

module.exports = (plugin) => {
  const getAuthController = plugin.controllers.auth;

  plugin.controllers.auth = ({ strapi }) => {
    const auth = getAuthController({ strapi });

    return {
      ...auth,

      // Sobrescribimos solo el callback de proveedores (Google, etc.)
      async callback(ctx, next) {
        strapi.log.info('[users-permissions] Callback extendido de Google ejecutándose...');

        // Ejecutar la lógica original de Strapi primero
        await auth.callback(ctx, next);

        try {
          const user = ctx?.state?.user;
          if (!user || user.provider !== 'google') return;

          const profile = ctx?.state?.oauth?.profile || ctx?.state?.profile || {};

          strapi.log.info('[users-permissions] Estado después de callback Google', {
            userId: user?.id,
            username: user?.username,
            email: user?.email,
            profileKeys: profile ? Object.keys(profile) : [],
          });

          const givenName =
            profile.given_name || profile.givenName || profile.first_name || profile.firstName;
          const familyName =
            profile.family_name || profile.familyName || profile.last_name || profile.lastName;
          const fullNameFromProfile =
            profile.name || [givenName, familyName].filter(Boolean).join(' ').trim();

          const fullname = fullNameFromProfile || user.username || user.email;
          if (!fullname) return;

          const hasFullname =
            typeof user.fullname === 'string' && user.fullname.trim().length > 0;
          if (hasFullname) {
            strapi.log.info(
              `[users-permissions] fullname ya estaba definido para el usuario ${user.id}`,
            );
            return;
          }

          const updated = await strapi
            .query('plugin::users-permissions.user')
            .update({ where: { id: user.id }, data: { fullname } });

          if (updated) {
            strapi.log.info(
              `[users-permissions] fullname actualizado para el usuario ${user.id}: "${fullname}"`,
            );
            ctx.state.user = { ...user, fullname };
          }
        } catch (e) {
          strapi.log.warn(
            `[users-permissions] No se pudo actualizar fullname desde Google: ${e?.message}`,
          );
        }
      },
    };
  };

  return plugin;
};

