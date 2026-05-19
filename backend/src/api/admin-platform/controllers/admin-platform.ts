import { getPlatformAdminEmails, isPlatformAdminEmail } from '../../../config/platform-admin';
import { adjustAccountPoints } from '../../../services/loyalty-core';

declare const strapi: any;

const USER_UID = 'plugin::users-permissions.user';
const MEMBER_UID = 'api::restaurant-member.restaurant-member';
const RESTAURANT_UID = 'api::restaurante.restaurante';
const ACCOUNT_UID = 'api::loyalty-account.loyalty-account';
const PEDIDO_UID = 'api::pedido.pedido';
const TX_UID = 'api::loyalty-transaction.loyalty-transaction';

const userFields = ['id', 'username', 'email', 'fullname', 'provider', 'confirmed', 'blocked', 'createdAt'];
const userDetailFields = [...userFields, 'phone', 'birthday'];

function userIdFromRelation(rel: any): number | null {
  if (rel == null) return null;
  const id = typeof rel === 'object' ? rel.id : rel;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

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

  /**
   * GET /admin/users/:id/detail
   * Perfil completo + memberships + fidelización + legacy owner.
   */
  async getUserDetail(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = Number(ctx.params.id);
    if (!id) return ctx.badRequest('id inválido');

    try {
      const user = await strapi.entityService.findOne(USER_UID, id, {
        fields: userDetailFields,
        populate: {
          role: { fields: ['id', 'name', 'type'] },
          restaurant_members: {
            fields: ['id', 'role', 'active', 'createdAt'],
            populate: {
              restaurante: { fields: ['id', 'name', 'slug', 'Suscripcion'] },
            },
          },
        },
      });
      if (!user) return ctx.notFound('Usuario no encontrado');

      const email = String(user.email || '').trim().toLowerCase();

      let loyaltyAccounts: any[] = [];
      try {
        loyaltyAccounts = await strapi.entityService.findMany(ACCOUNT_UID, {
          filters: { users_permissions_user: id },
          fields: ['id', 'pointsBalance', 'lifetimePoints', 'birthday', 'createdAt', 'updatedAt'],
          populate: {
            restaurante: { fields: ['id', 'name', 'slug'] },
          },
          sort: { updatedAt: 'desc' },
          limit: 100,
        });
      } catch (loyErr: any) {
        strapi.log.warn('[admin.getUserDetail] loyalty_accounts:', loyErr?.message);
      }

      const allRestaurants = await strapi.entityService.findMany(RESTAURANT_UID, {
        fields: ['id', 'name', 'slug', 'Suscripcion', 'owner_email'],
        limit: 5000,
      });
      const legacyRestaurants = (allRestaurants || []).filter(
        (r: any) => String(r.owner_email || '').trim().toLowerCase() === email
      );

      const memberSlugs = new Set(
        (user.restaurant_members || [])
          .filter((m: any) => m.active !== false)
          .map((m: any) => m.restaurante?.slug)
          .filter(Boolean)
      );
      const legacyOnly = (legacyRestaurants || []).filter(
        (r: any) => !memberSlugs.has(r.slug)
      );

      let orders: any[] = [];
      try {
        orders = await strapi.entityService.findMany(PEDIDO_UID, {
          filters: { users_permissions_user: id },
          fields: [
            'id',
            'total',
            'order_status',
            'payment_status',
            'payment_method',
            'createdAt',
            'mesaNumber',
            'loyalty_points_earned',
            'loyalty_points_redeemed',
            'loyalty_discount_percent',
          ],
          populate: {
            restaurante: { fields: ['id', 'name', 'slug'] },
          },
          sort: { createdAt: 'desc' },
          limit: 80,
        });
      } catch (ordErr: any) {
        strapi.log.warn('[admin.getUserDetail] pedidos:', ordErr?.message);
      }

      let loyaltyTransactions: any[] = [];
      const accountIds = (loyaltyAccounts || []).map((a: any) => a.id).filter(Boolean);
      if (accountIds.length) {
        try {
          loyaltyTransactions = await strapi.entityService.findMany(TX_UID, {
            filters: { loyalty_account: { id: { $in: accountIds } } },
            fields: ['id', 'delta', 'reason', 'notes', 'createdAt'],
            populate: {
              loyalty_account: {
                fields: ['id'],
                populate: { restaurante: { fields: ['id', 'name', 'slug'] } },
              },
              pedido: { fields: ['id', 'total', 'createdAt'] },
            },
            sort: { createdAt: 'desc' },
            limit: 100,
          });
        } catch (txErr: any) {
          strapi.log.warn('[admin.getUserDetail] loyalty_transactions:', txErr?.message);
        }
      }

      const paidOrders = (orders || []).filter((p: any) => p.order_status === 'paid');
      const orderStats = {
        orderCount: (orders || []).length,
        paidOrderCount: paidOrders.length,
        totalSpent: paidOrders.reduce((s: number, p: any) => s + (Number(p.total) || 0), 0),
        lastOrderAt: orders[0]?.createdAt || null,
      };

      ctx.body = {
        data: {
          user,
          loyaltyAccounts: loyaltyAccounts || [],
          legacyOwnerRestaurants: legacyOnly,
          isPlatformAdmin: isPlatformAdminEmail(email),
          orders: orders || [],
          loyaltyTransactions: loyaltyTransactions || [],
          orderStats,
        },
      };
    } catch (err: any) {
      strapi.log.error('[admin.getUserDetail]', err);
      ctx.status = 500;
      ctx.body = { error: { message: err?.message || 'Error al cargar detalle' } };
    }
  },

  /**
   * GET /admin/customers
   * Comensales de la app: usuarios con pedidos vinculados y/o cuenta de fidelización.
   */
  async listCustomers(ctx: any) {
    const strapi: any = ctx.strapi;
    const { search, page = 1, pageSize = 50, restauranteId } = ctx.request.query || {};
    const pg = Math.max(1, Number(page));
    const limit = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const restId = restauranteId ? Number(restauranteId) : null;

    try {
      const customerIds = new Set<number>();
      const statsByUser = new Map<number, { orderCount: number; totalSpent: number; lastOrderAt: string | null }>();
      const loyaltyPointsByUser = new Map<number, number>();

      const accountFilters: any = {};
      if (restId) accountFilters.restaurante = restId;

      let accounts: any[] = [];
      try {
        accounts = await strapi.entityService.findMany(ACCOUNT_UID, {
          filters: accountFilters,
          fields: ['id', 'pointsBalance'],
          populate: { users_permissions_user: { fields: ['id'] } },
          limit: 5000,
        });
      } catch (e: any) {
        strapi.log.warn('[admin.listCustomers] loyalty_accounts:', e?.message);
      }

      for (const acc of accounts || []) {
        const uid = userIdFromRelation(acc.users_permissions_user);
        if (!uid) continue;
        customerIds.add(uid);
        loyaltyPointsByUser.set(uid, (loyaltyPointsByUser.get(uid) || 0) + (Number(acc.pointsBalance) || 0));
      }

      const pedidoFilters: any = {};
      if (restId) pedidoFilters.restaurante = restId;

      const pedidos = await strapi.entityService.findMany(PEDIDO_UID, {
        filters: pedidoFilters,
        fields: ['id', 'total', 'order_status', 'createdAt'],
        populate: { users_permissions_user: { fields: ['id'] } },
        sort: { createdAt: 'desc' },
        limit: 8000,
      });

      for (const p of pedidos || []) {
        const uid = userIdFromRelation(p.users_permissions_user);
        if (!uid) continue;
        customerIds.add(uid);
        const prev = statsByUser.get(uid) || { orderCount: 0, totalSpent: 0, lastOrderAt: null };
        prev.orderCount += 1;
        if (p.order_status === 'paid') {
          prev.totalSpent += Number(p.total) || 0;
        }
        const created = p.createdAt ? String(p.createdAt) : null;
        if (created && (!prev.lastOrderAt || new Date(created) > new Date(prev.lastOrderAt))) {
          prev.lastOrderAt = created;
        }
        statsByUser.set(uid, prev);
      }

      let idList = [...customerIds];
      if (!idList.length) {
        ctx.body = {
          data: [],
          meta: { pagination: { page: pg, pageSize: limit, total: 0, pageCount: 0 } },
        };
        return;
      }

      if (search) {
        const matched = await strapi.entityService.findMany(USER_UID, {
          filters: {
            id: { $in: idList },
            $or: [
              { email: { $containsi: search } },
              { username: { $containsi: search } },
              { fullname: { $containsi: search } },
              { phone: { $containsi: search } },
            ],
          },
          fields: ['id'],
          limit: 5000,
        });
        idList = (matched || []).map((u: any) => u.id);
      }

      idList.sort((a, b) => {
        const ta = statsByUser.get(a)?.lastOrderAt || '';
        const tb = statsByUser.get(b)?.lastOrderAt || '';
        return new Date(tb || 0).getTime() - new Date(ta || 0).getTime();
      });

      const total = idList.length;
      const pageIds = idList.slice((pg - 1) * limit, pg * limit);

      if (!pageIds.length) {
        ctx.body = {
          data: [],
          meta: {
            pagination: {
              page: pg,
              pageSize: limit,
              total,
              pageCount: Math.ceil(total / limit) || 0,
            },
          },
        };
        return;
      }

      const users = await strapi.entityService.findMany(USER_UID, {
        filters: { id: { $in: pageIds } },
        fields: userDetailFields,
        populate: { role: { fields: ['id', 'name', 'type'] } },
        limit: pageIds.length,
      });

      const userById = new Map((users || []).map((u: any) => [u.id, u]));
      const data = pageIds
        .map((id) => {
          const u = userById.get(id);
          if (!u) return null;
          const st = statsByUser.get(id);
          return {
            ...u,
            stats: {
              orderCount: st?.orderCount || 0,
              totalSpent: st?.totalSpent || 0,
              lastOrderAt: st?.lastOrderAt || null,
              loyaltyPoints: loyaltyPointsByUser.get(id) || 0,
            },
          };
        })
        .filter(Boolean);

      ctx.body = {
        data,
        meta: {
          pagination: {
            page: pg,
            pageSize: limit,
            total,
            pageCount: Math.ceil(total / limit) || 0,
          },
        },
      };
    } catch (err: any) {
      strapi.log.error('[admin.listCustomers]', err);
      ctx.status = 500;
      ctx.body = { error: { message: err?.message || 'Error al listar clientes' } };
    }
  },

  /**
   * POST /admin/users/:id/impersonate
   * body: { slug?: string } — si hay varios locales, abre el indicado.
   */
  async impersonateUser(ctx: any) {
    const strapi: any = ctx.strapi;
    const id = Number(ctx.params.id);
    const body = ctx.request.body?.data || ctx.request.body || {};
    const slugHint = body.slug ? String(body.slug).trim() : null;

    const user = await strapi.entityService.findOne(USER_UID, id, {
      fields: ['id', 'email', 'username', 'fullname', 'blocked'],
      populate: {
        restaurant_members: {
          fields: ['id', 'role', 'active'],
          populate: { restaurante: { fields: ['id', 'slug', 'name'] } },
        },
      },
    });
    if (!user) return ctx.notFound('Usuario no encontrado');
    if (user.blocked) return ctx.badRequest('El usuario está bloqueado');

    const activeMembers = (user.restaurant_members || []).filter((m: any) => m.active !== false);
    let targetSlug = slugHint;

    if (!targetSlug) {
      const ownerMember = activeMembers.find((m: any) => m.role === 'owner');
      const pick = ownerMember || activeMembers[0];
      targetSlug = pick?.restaurante?.slug || null;
    }

    if (!targetSlug && user.email) {
      const emailLower = String(user.email).trim().toLowerCase();
      const allRest = await strapi.entityService.findMany(RESTAURANT_UID, {
        fields: ['id', 'slug', 'owner_email'],
        limit: 5000,
      });
      const legacy = (allRest || []).find(
        (r: any) => String(r.owner_email || '').trim().toLowerCase() === emailLower
      );
      targetSlug = legacy?.slug || null;
    }

    if (!targetSlug) {
      return ctx.badRequest('Este usuario no tiene acceso a ningún restaurante para abrir el panel');
    }

    const jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: user.id });

    ctx.body = {
      jwt,
      slug: targetSlug,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        username: user.username,
      },
    };
  },

  /**
   * POST /admin/users/:id/loyalty-accounts/:accountId/adjust
   */
  async adjustUserLoyalty(ctx: any) {
    const strapi: any = ctx.strapi;
    const userId = Number(ctx.params.id);
    const accountId = Number(ctx.params.accountId);
    const body = ctx.request.body?.data || ctx.request.body || {};
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return ctx.badRequest('delta inválido');
    }

    const account = await strapi.entityService.findOne(ACCOUNT_UID, accountId, {
      populate: { users_permissions_user: { fields: ['id'] } },
    });
    if (!account) return ctx.notFound('Cuenta de fidelización no encontrada');
    const uid = account.users_permissions_user?.id ?? account.users_permissions_user;
    if (String(uid) !== String(userId)) {
      return ctx.forbidden('La cuenta no pertenece a este usuario');
    }

    const result = await adjustAccountPoints(
      strapi,
      accountId,
      delta,
      body.notes || 'Ajuste Super Admin'
    );
    ctx.body = { data: result };
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
    if (body.phone !== undefined) allowed.phone = body.phone;
    if (body.birthday !== undefined) allowed.birthday = body.birthday || null;
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
