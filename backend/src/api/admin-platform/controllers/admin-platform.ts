import { getPlatformAdminEmails } from '../../../config/platform-admin';

declare const strapi: any;

const USER_UID = 'plugin::users-permissions.user';
const MEMBER_UID = 'api::restaurant-member.restaurant-member';
const RESTAURANT_UID = 'api::restaurante.restaurante';

const userFields = ['id', 'username', 'email', 'fullname', 'provider', 'confirmed', 'blocked', 'createdAt'];

export default {
  async authCheck(ctx: any) {
    ctx.body = {
      ok: true,
      email: ctx.state.user?.email,
      isPlatformAdmin: true,
    };
  },

  /**
   * GET /api/admin/permissions-overview
   * Vista unificada: email, rol Strapi, memberships, legacy owner_email, super admin.
   */
  async permissionsOverview(ctx: any) {
    const strapi: any = ctx.strapi;
    const { search, page = 1, pageSize = 50, filter } = ctx.request.query || {};
    const pg = Math.max(1, Number(page));
    const limit = Math.min(500, Math.max(1, Number(pageSize)));

    const filters: any = {};
    if (search) {
      filters.$or = [
        { email: { $containsi: search } },
        { username: { $containsi: search } },
        { fullname: { $containsi: search } },
      ];
    }
    if (filter === 'blocked') filters.blocked = true;
    if (filter === 'owners') {
      // filtrado post-query por memberships owner
    }

    const total = await strapi.entityService.count(USER_UID, { filters });

    const users = await strapi.entityService.findMany(USER_UID, {
      filters,
      fields: userFields,
      populate: {
        role: { fields: ['id', 'name', 'type'] },
        restaurant_members: {
          fields: ['id', 'role', 'active'],
          populate: {
            restaurante: { fields: ['id', 'name', 'slug'] },
          },
        },
      },
      sort: { createdAt: 'desc' },
      start: (pg - 1) * limit,
      limit,
    });

    const restaurants = await strapi.entityService.findMany(RESTAURANT_UID, {
      fields: ['id', 'name', 'slug', 'owner_email'],
      limit: 5000,
    });

    const adminEmails = new Set(getPlatformAdminEmails());

    const rows = (users || []).map((u: any) => {
      const email = String(u.email || '').trim().toLowerCase();
      const activeMembers = (u.restaurant_members || []).filter((m: any) => m.active !== false);
      const membershipSummary = activeMembers.map((m: any) => ({
        restauranteId: m.restaurante?.id,
        name: m.restaurante?.name,
        slug: m.restaurante?.slug,
        role: m.role,
      }));

      const memberRestaurantIds = new Set(
        activeMembers.map((m: any) => String(m.restaurante?.id)).filter(Boolean)
      );

      const legacyOwner = (restaurants || [])
        .filter((r: any) => {
          const oe = String(r.owner_email || '').trim().toLowerCase();
          return oe && oe === email && !memberRestaurantIds.has(String(r.id));
        })
        .map((r: any) => ({ id: r.id, name: r.name, slug: r.slug }));

      return {
        id: u.id,
        email: u.email,
        fullname: u.fullname,
        username: u.username,
        blocked: u.blocked,
        confirmed: u.confirmed,
        strapiRole: u.role?.name || null,
        strapiRoleType: u.role?.type || null,
        isPlatformAdmin: adminEmails.has(email),
        memberships: membershipSummary,
        legacyOwnerRestaurants: legacyOwner,
        isOwner: activeMembers.some((m: any) => m.role === 'owner') || legacyOwner.length > 0,
        isStaff: activeMembers.some((m: any) => m.role === 'staff'),
      };
    });

    let filteredRows = rows;
    if (filter === 'owners') {
      filteredRows = rows.filter((r: any) => r.isOwner);
    }
    if (filter === 'superadmin') {
      filteredRows = rows.filter((r: any) => r.isPlatformAdmin);
    }

    const stats = {
      totalUsers: total,
      platformAdmins: adminEmails.size,
      ownersInPage: filteredRows.filter((r: any) => r.isOwner).length,
    };

    ctx.body = {
      data: filteredRows,
      meta: {
        pagination: {
          page: pg,
          pageSize: limit,
          total,
          pageCount: Math.ceil(total / limit) || 1,
        },
        stats,
        platformAdminEmails: [...adminEmails],
      },
    };
  },

  async listUsers(ctx: any) {
    const strapi: any = ctx.strapi;
    try {
      const { search, blocked, page = 1, pageSize = 50 } = ctx.request.query || {};
      const limit = Math.min(200, Math.max(1, Number(pageSize) || 50));
      const pg = Math.max(1, Number(page) || 1);

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
            fields: ['id', 'role', 'active'],
            populate: {
              restaurante: { fields: ['id', 'name', 'slug'] },
            },
          },
        },
        sort: { createdAt: 'desc' },
        start: (pg - 1) * limit,
        limit,
      });

      ctx.body = { data: users || [] };
    } catch (err: any) {
      strapi.log.error('[admin.listUsers]', err);
      ctx.status = 500;
      ctx.body = {
        error: { message: err?.message || 'Error al listar usuarios' },
      };
    }
  },

  async getUser(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = ctx.params.id;

    const user = await strapi.entityService.findOne(USER_UID, id, {
      fields: userFields,
      populate: {
        role: { fields: ['id', 'name', 'type'] },
        restaurant_members: {
          fields: ['id', 'role', 'active'],
          populate: {
            restaurante: { fields: ['id', 'name', 'slug'] },
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
    try {
      const { restauranteId, userId, page = 1, pageSize = 100 } = ctx.request.query || {};
      const limit = Math.min(500, Math.max(1, Number(pageSize) || 100));
      const pg = Math.max(1, Number(page) || 1);

      const filters: any = {};
      if (restauranteId) filters.restaurante = restauranteId;
      if (userId) filters.users_permissions_user = userId;

      const members = await strapi.entityService.findMany(MEMBER_UID, {
        filters,
        fields: ['id', 'role', 'active', 'createdAt'],
        populate: {
          users_permissions_user: { fields: ['id', 'email', 'fullname', 'username'] },
          restaurante: { fields: ['id', 'name', 'slug'] },
        },
        sort: { createdAt: 'desc' },
        start: (pg - 1) * limit,
        limit,
      });

      ctx.body = { data: members || [] };
    } catch (err: any) {
      strapi.log.error('[admin.listMemberships]', err);
      ctx.status = 500;
      ctx.body = {
        error: { message: err?.message || 'Error al listar memberships' },
      };
    }
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
