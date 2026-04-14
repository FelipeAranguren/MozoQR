declare const strapi: any;

const USER_UID = 'plugin::users-permissions.user';
const MEMBER_UID = 'api::restaurant-member.restaurant-member';
const RESTAURANT_UID = 'api::restaurante.restaurante';

const userFields = ['id', 'username', 'email', 'fullname', 'provider', 'confirmed', 'blocked', 'createdAt'];

export default {
  async listUsers(ctx: any) {
    const strapi: any = ctx.strapi;
    const { search, blocked, page = 1, pageSize = 50 } = ctx.request.query || {};

    const filters: any = {};
    if (blocked === 'true') filters.blocked = true;
    if (blocked === 'false') filters.blocked = false;
    if (search) {
      filters.$or = [
        { email: { $containsi: search } },
        { username: { $containsi: search } },
        { fullname: { $containsi: search } },
      ];
    }

    const users = await strapi.entityService.findMany(USER_UID, {
      filters,
      fields: userFields,
      populate: {
        role: { fields: ['id', 'name', 'type'] },
        restaurant_members: {
          publicationState: 'preview',
          fields: ['id', 'role', 'active'],
          populate: {
            restaurante: {
              publicationState: 'preview',
              fields: ['id', 'name', 'slug'],
            },
          },
        },
      },
      sort: { createdAt: 'desc' },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: users };
  },

  async getUser(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;

    const user = await strapi.entityService.findOne(USER_UID, id, {
      fields: userFields,
      populate: {
        role: { fields: ['id', 'name', 'type'] },
        restaurant_members: {
          publicationState: 'preview',
          fields: ['id', 'role', 'active'],
          populate: {
            restaurante: {
              publicationState: 'preview',
              fields: ['id', 'name', 'slug'],
            },
          },
        },
      },
    });

    if (!user) return ctx.notFound('Usuario no encontrado');
    ctx.body = { data: user };
  },

  async createUser(ctx: any) {
    const strapi: any = ctx.strapi;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { email, username, fullname, password } = body;

    if (!email || !password) return ctx.badRequest('email y password son requeridos');

    const existing = await strapi.db.query(USER_UID).findOne({
      where: { email: email.toLowerCase().trim() },
      select: ['id'],
    });
    if (existing) return ctx.badRequest('Ya existe un usuario con ese email');

    const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
      select: ['id'],
    });

    const user = await strapi.entityService.create(USER_UID, {
      data: {
        email: email.toLowerCase().trim(),
        username: username || email.split('@')[0],
        fullname: fullname || '',
        password,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: defaultRole?.id || null,
      },
    });

    ctx.body = { data: { id: user.id, email: user.email, username: user.username, fullname: user.fullname } };
  },

  async updateUser(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;
    const body = ctx.request.body?.data || ctx.request.body || {};

    const allowed: any = {};
    if (body.fullname !== undefined) allowed.fullname = body.fullname;
    if (body.email !== undefined) allowed.email = body.email;
    if (body.username !== undefined) allowed.username = body.username;
    if (body.confirmed !== undefined) allowed.confirmed = body.confirmed;
    if (body.blocked !== undefined) allowed.blocked = body.blocked;

    if (Object.keys(allowed).length === 0) return ctx.badRequest('No hay campos para actualizar');

    const updated = await strapi.entityService.update(USER_UID, id, { data: allowed });
    if (!updated) return ctx.notFound('Usuario no encontrado');

    ctx.body = { data: { id: updated.id, email: updated.email, username: updated.username, fullname: updated.fullname, blocked: updated.blocked, confirmed: updated.confirmed } };
  },

  async toggleBlock(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;

    const user = await strapi.entityService.findOne(USER_UID, id, { fields: ['id', 'blocked', 'email'] });
    if (!user) return ctx.notFound('Usuario no encontrado');

    const updated = await strapi.entityService.update(USER_UID, id, {
      data: { blocked: !user.blocked },
    });

    ctx.body = { data: { id: updated.id, email: updated.email, blocked: updated.blocked } };
  },

  async resetPassword(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { password } = body;

    if (!password || password.length < 6) return ctx.badRequest('Password debe tener al menos 6 caracteres');

    const user = await strapi.entityService.findOne(USER_UID, id, { fields: ['id'] });
    if (!user) return ctx.notFound('Usuario no encontrado');

    await strapi.entityService.update(USER_UID, id, { data: { password } });

    ctx.body = { data: { id, message: 'Password actualizada' } };
  },

  async listMemberships(ctx: any) {
    const strapi: any = ctx.strapi;
    const { restauranteId, userId, page = 1, pageSize = 100 } = ctx.request.query || {};

    const filters: any = {};
    if (restauranteId) filters.restaurante = restauranteId;
    if (userId) filters.users_permissions_user = userId;

    const members = await strapi.entityService.findMany(MEMBER_UID, {
      filters,
      publicationState: 'preview',
      fields: ['id', 'role', 'active', 'createdAt'],
      populate: {
        users_permissions_user: { fields: ['id', 'email', 'fullname', 'username'] },
        restaurante: {
          publicationState: 'preview',
          fields: ['id', 'name', 'slug'],
        },
      },
      sort: { createdAt: 'desc' },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: members };
  },

  async updateMembership(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;
    const body = ctx.request.body?.data || ctx.request.body || {};

    const allowed: any = {};
    if (body.role !== undefined) allowed.role = body.role;
    if (body.active !== undefined) allowed.active = body.active;

    if (Object.keys(allowed).length === 0) return ctx.badRequest('No hay campos para actualizar');

    const updated = await strapi.entityService.update(MEMBER_UID, id, { data: allowed });
    if (!updated) return ctx.notFound('Membership no encontrada');

    ctx.body = { data: updated };
  },

  async createMembership(ctx: any) {
    const strapi: any = ctx.strapi;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { userId, restauranteId, role = 'staff' } = body;

    if (!userId || !restauranteId) return ctx.badRequest('userId y restauranteId son requeridos');

    const existing = await strapi.db.query(MEMBER_UID).findOne({
      where: {
        users_permissions_user: { id: userId },
        restaurante: { id: restauranteId },
      },
      select: ['id', 'active'],
    });

    if (existing) {
      const reactivated = await strapi.entityService.update(MEMBER_UID, existing.id, {
        data: { role, active: true },
      });
      ctx.body = { data: reactivated, meta: { reactivated: true } };
      return;
    }

    const created = await strapi.entityService.create(MEMBER_UID, {
      data: {
        users_permissions_user: userId,
        restaurante: restauranteId,
        role,
        active: true,
      },
    });

    ctx.body = { data: created };
  },
};
