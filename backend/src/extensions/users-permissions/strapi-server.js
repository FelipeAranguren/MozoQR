'use strict';

module.exports = (plugin) => {
  const originalCallback = plugin.controllers?.auth?.callback;

  if (originalCallback) {
    plugin.controllers.auth.callback = async (ctx, next) => {
      await originalCallback(ctx, next);

      try {
        const user = ctx?.state?.user;
        if (!user || user.provider !== 'google') return;

        const profile = ctx?.state?.oauth?.profile || ctx?.state?.profile || {};
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
        if (hasFullname) return;

        const updated = await strapi
          .query('plugin::users-permissions.user')
          .update({ where: { id: user.id }, data: { fullname } });

        if (updated) {
          ctx.state.user = { ...user, fullname };
        }
      } catch (e) {
        strapi.log.warn(
          `[users-permissions] No se pudo actualizar fullname desde Google: ${e?.message}`,
        );
      }
    };
  }

  return plugin;
};

