'use strict';

/**
 * Obtiene el nombre completo del usuario desde Google userinfo.
 * El providers-registry de Strapi solo usa tokeninfo (solo email); esta llamada a userinfo
 * devuelve name, given_name, family_name.
 * En Admin > Settings > Users & Permissions > Providers > Google, el scope debe incluir
 * "profile" (o "openid profile email") para que Google devuelva el nombre.
 */
async function fetchGoogleFullname(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo: ${res.status}`);
  }
  const body = await res.json();
  const name = body.name || [body.given_name, body.family_name].filter(Boolean).join(' ').trim();
  return name || null;
}

module.exports = (plugin) => {
  // 1) Sobrescribir el servicio providers para completar fullname tras conectar con Google
  const originalProvidersFactory = plugin.services.providers;
  if (typeof originalProvidersFactory === 'function') {
    plugin.services.providers = (opts) => {
      const original = originalProvidersFactory(opts);
      const strapi = opts?.strapi;
      return {
        ...original,
        async connect(provider, query) {
          const user = await original.connect(provider, query);
          if (provider !== 'google' || !user) return user;

          const accessToken = query.access_token || query.code || query.oauth_token;
          if (!accessToken) return user;

          const hasFullname =
            typeof user.fullname === 'string' && user.fullname.trim().length > 0;
          if (hasFullname) return user;

          try {
            const fullname = await fetchGoogleFullname(accessToken);
            if (fullname) {
              await strapi.db
                .query('plugin::users-permissions.user')
                .update({ where: { id: user.id }, data: { fullname } });
              user.fullname = fullname;
              strapi.log.info(
                `[users-permissions] fullname desde Google userinfo para usuario ${user.id}: "${fullname}"`
              );
            }
          } catch (e) {
            strapi.log.warn(
              `[users-permissions] No se pudo obtener nombre de Google userinfo: ${e?.message}`
            );
          }
          return user;
        },
      };
    };
  }

  // 2) Callback de auth: si en algún flujo el perfil ya trae nombre, también actualizamos fullname
  const getAuthController = plugin.controllers.auth;
  plugin.controllers.auth = ({ strapi }) => {
    const auth = getAuthController({ strapi });

    return {
      ...auth,
      async callback(ctx, next) {
        await auth.callback(ctx, next);

        const user = ctx?.state?.user;
        if (!user || user.provider !== 'google') return;

        const profile = ctx?.state?.oauth?.profile || ctx?.state?.profile || {};
        const givenName =
          profile.given_name || profile.givenName || profile.first_name || profile.firstName;
        const familyName =
          profile.family_name || profile.familyName || profile.last_name || profile.lastName;
        const fullNameFromProfile =
          profile.name || [givenName, familyName].filter(Boolean).join(' ').trim();
        const fullname = fullNameFromProfile || user.fullname || user.username || user.email;
        if (!fullname) return;

        const hasFullname =
          typeof user.fullname === 'string' && user.fullname.trim().length > 0;
        if (hasFullname) return;

        try {
          await strapi
            .query('plugin::users-permissions.user')
            .update({ where: { id: user.id }, data: { fullname } });
          ctx.state.user = { ...user, fullname };
        } catch (e) {
          strapi.log.warn(
            `[users-permissions] No se pudo actualizar fullname en callback: ${e?.message}`
          );
        }
      },
    };
  };

  return plugin;
};

