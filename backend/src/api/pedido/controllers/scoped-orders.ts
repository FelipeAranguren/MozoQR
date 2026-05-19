/**
 * scoped-orders controller
 */

import { safeDeductStockForPaidOrder } from '../services/deduct-stock-for-order';
import {
    getFullOrder,
    loadStaffOrder,
    recalculateOrderTotal,
    validateProductForRestaurant,
} from '../services/order-items';
import { notifyNewOrder, type PrintOrderItem } from '../../../lib/print-server';
import { creditLoyaltyForPaidOrder } from '../../../services/loyalty-core';

declare const strapi: any;

async function createCajaIngresoForOrder(strapi: any, orderId: number, restauranteId: number, total: number, paymentMethod?: string) {
    try {
        const [openCaja] = await strapi.entityService.findMany('api::caja-sesion.caja-sesion', {
            filters: { restaurante: restauranteId, status: 'open' },
            fields: ['id'],
            limit: 1,
        });

        const cajaPm = paymentMethod === 'cash' ? 'efectivo'
            : paymentMethod === 'card_present' ? 'tarjeta'
            : paymentMethod === 'qr' || paymentMethod === 'online' ? 'digital'
            : 'otro';

        await strapi.entityService.create('api::movimiento-caja.movimiento-caja', {
            data: {
                type: 'ingreso',
                amount: Number(total) || 0,
                concept: `Cobro pedido #${orderId}`,
                category: 'venta',
                payment_method: cajaPm,
                timestamp: new Date().toISOString(),
                caja_sesion: openCaja?.id || null,
                pedido: orderId,
            },
        });
    } catch (err) {
        console.error('[createCajaIngresoForOrder] Error:', err);
    }
}

const ALLOWED_NEXT: Record<string, string[]> = {
    pending: ['preparing', 'served', 'paid'],
    preparing: ['served', 'paid'],
    served: ['paid'],
    paid: [],
};

interface OrderItemPayload {
    productId?: number;
    product?: number;
    id?: number;
    quantity?: number;
    qty?: number;
    notes?: string;
}

interface OrderPayload {
    table: number;
    tableSessionId?: string;
    items: OrderItemPayload[];
    notes?: string;
}

interface NormalizedItem {
    product: number;
    quantity: number;
    UnitPrice: number;
    totalPrice: number;
    notes: string | null;
}

async function getMesaByNumber(strapi: any, restauranteId: number, number: number) {
    const [mesa] = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: { restaurante: restauranteId, number: Number(number) },
        fields: ['id', 'number'],
        limit: 1,
    });
    return mesa;
}

async function getOrCreateMesaSesion(strapi: any, restauranteId: number, mesaId: number, tableSessionId?: string) {
    // Try by code (uid) + open
    const [ses] = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: restauranteId,
            mesa: mesaId,
            code: tableSessionId || undefined,
            session_status: 'open',
        },
        fields: ['id', 'code', 'session_status'],
        limit: 1,
    });
    if (ses?.id) return ses;

    // Create one if not found
    const nowIso = new Date().toISOString();
    const created = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
        data: {
            code: tableSessionId || `sess_${Date.now()}`,
            openedAt: nowIso,
            session_status: 'open',
            mesa: mesaId,
            restaurante: restauranteId,
            total: 0,
            paidTotal: 0,
        },
    });
    return created;
}

export default {
    /**
     * GET /restaurants/:slug/orders?status=&table=&since=ISO
     * Staff/Owner only. Returns orders scoped by restaurant.
     */
    async find(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        if (restauranteId == null) {
            return ctx.forbidden('No autorizado');
        }
        const { status, table, since } = ctx.request.query || {};

        const filters: any = { restaurante: restauranteId };
        if (status) filters.order_status = status;
        if (table) filters['mesa_sesion'] = { mesa: { number: Number(table) } }; // Adjusted filter structure for TS/Strapi v4
        if (since) filters.createdAt = { $gt: since };

        const rows = await strapi.entityService.findMany('api::pedido.pedido', {
            filters,
            sort: { createdAt: 'desc' },
            populate: {
                mesa_sesion: { populate: { mesa: { fields: ['number', 'displayName'] } } },
                items: { populate: { product: { fields: ['name', 'sku'], populate: { image: true } } } },
            },
            fields: ['id', 'order_status', 'total', 'customerNotes', 'createdAt', 'updatedAt'],
            publicationState: 'live',
            limit: 200,
        });

        ctx.body = { data: rows };
    },

    /**
     * POST /restaurants/:slug/orders
     * body: { table, tableSessionId, items: [{ productId, quantity, notes }], notes }
     * Public endpoint.
     */
    async create(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
        const { table, tableSessionId, items, notes } = payload as OrderPayload;

        if (!table) return ctx.badRequest('Falta número de mesa');
        if (!Array.isArray(items) || items.length === 0) {
            return ctx.badRequest('Items vacíos');
        }

        // Mesa + sesión
        const mesa = await getMesaByNumber(strapi, restauranteId, table);
        if (!mesa?.id) return ctx.badRequest('Mesa inválida');
        const sesion = await getOrCreateMesaSesion(strapi, restauranteId, mesa.id, tableSessionId);

        // Validar productos y calcular subtotal con precios actuales
        let subtotal = 0;
        const normalized: NormalizedItem[] = [];
        for (const it of items) {
            const pid = it.productId || it.product || it.id;
            const qty = Number(it.quantity || it.qty || 0);
            const note = it.notes || null;
            if (!pid || qty <= 0) return ctx.badRequest('Producto o cantidad inválida');

            const prod = await strapi.entityService.findOne('api::producto.producto', pid, {
                fields: ['id', 'name', 'price', 'available'],
                populate: { categoria: { fields: ['id'] }, restaurante: { fields: ['id'] } },
            });
            if (!prod?.id) return ctx.badRequest(`Producto ${pid} inexistente`);
            if (String(prod.restaurante?.id || prod.restaurante) !== String(restauranteId)) {
                return ctx.badRequest('Producto no pertenece a este restaurante');
            }
            if (!prod.available) return ctx.badRequest(`Producto no disponible: ${prod.name}`);

            const unit = Number(prod.price || 0);
            const total = unit * qty;
            subtotal += total;
            normalized.push({ product: pid, quantity: qty, UnitPrice: unit, totalPrice: total, notes: note });
        }

        // Idempotencia best-effort (últimos 90s, misma sesión y total)
        const ninetyAgo = new Date(Date.now() - 90_000).toISOString();
        const existing = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: {
                restaurante: restauranteId,
                mesa_sesion: sesion.id,
                total: subtotal,
                createdAt: { $gt: ninetyAgo },
                order_status: 'pending',
            },
            fields: ['id'],
            limit: 1,
        });
        if (existing?.[0]?.id) {
            // Return existing to avoid duplicates
            const dup = await strapi.entityService.findOne('api::pedido.pedido', existing[0].id, {
                populate: { items: true, mesa_sesion: true },
            });
            ctx.status = 200;
            ctx.body = { data: dup, meta: { deduped: true } };
            return;
        }

        // Crear pedido + items
        const staffUserId = ctx.state?.user?.id;
        const created = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                order_status: 'pending',
                total: subtotal,
                customerNotes: notes || null,
                mesa_sesion: sesion.id,
                restaurante: restauranteId,
                mesaNumber: mesa?.number ? Number(mesa.number) : null,
                ...(staffUserId ? { users_permissions_user: Number(staffUserId) } : {}),
            },
        });

        for (const row of normalized) {
            await strapi.entityService.create('api::item-pedido.item-pedido', {
                data: { ...row, order: created.id },
            });
        }

        strapi.log?.info?.(
            `[scoped-orders.create] inventario → safeDeductStockForPaidOrder pedido=${created.id} restauranteId=${restauranteId}`,
        );
        await safeDeductStockForPaidOrder(strapi, created.id, restauranteId);

        const full = await strapi.entityService.findOne('api::pedido.pedido', created.id, {
            populate: {
                items: { populate: { product: { fields: ['name', 'sku'] } } },
                mesa_sesion: { populate: { mesa: { fields: ['number'] } } },
            },
        });

        ctx.body = { data: full };

        // Notificar al programa de impresión (best-effort, no bloquea la respuesta)
        try {
            const slug = ctx.params?.slug as string | undefined;
            if (slug && full) {
                notifyNewOrder(slug, {
                    orderId: full.id,
                    restaurantSlug: slug,
                    mesaNumber: full.mesaNumber ?? null,
                    customerNotes: full.customerNotes ?? null,
                    total: Number(full.total) || 0,
                    createdAt: full.createdAt || new Date().toISOString(),
                    items: (full.items ?? []).map((it: any): PrintOrderItem => ({
                        name: it.product?.name ?? 'Producto',
                        sku: it.product?.sku ?? null,
                        quantity: it.quantity ?? 0,
                        unitPrice: Number(it.UnitPrice) || 0,
                        totalPrice: Number(it.totalPrice) || 0,
                        notes: it.notes ?? null,
                    })),
                });
            }
        } catch (err: any) {
            strapi.log?.warn?.('[scoped-orders.create] Error notificando impresora: ' + (err?.message || err));
        }
    },

    /**
     * PATCH /restaurants/:slug/orders/:id/status
     * body: { status }
     */
    async updateStatus(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        if (restauranteId == null) {
            return ctx.forbidden('No autorizado');
        }
        const id = ctx.params.id;
        const { status } = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

        if (!status) return ctx.badRequest('Falta status');

        const order = await strapi.entityService.findOne('api::pedido.pedido', id, {
            fields: ['id', 'order_status'],
            populate: { restaurante: { fields: ['id'] } },
        });
        if (!order?.id) return ctx.notFound('Pedido no encontrado');
        if (String(order.restaurante?.id || order.restaurante) !== String(restauranteId)) {
            return ctx.unauthorized('Pedido de otro restaurante');
        }

        const current = order.order_status;
        const allowed = ALLOWED_NEXT[current] || [];
        if (!allowed.includes(status)) {
            return ctx.badRequest(`Transición inválida: ${current} → ${status}`);
        }

        const updated = await strapi.entityService.update('api::pedido.pedido', id, {
            data: { order_status: status },
        });

        if (status === 'paid') {
            const fullOrder = await strapi.entityService.findOne('api::pedido.pedido', id, {
                fields: ['id', 'total', 'payment_method'],
            });
            await createCajaIngresoForOrder(strapi, id, restauranteId, fullOrder?.total || 0, fullOrder?.payment_method);
            strapi.log?.info?.(
                `[scoped-orders.updateStatus] paid → safeDeductStockForPaidOrder pedido=${id} restauranteId=${restauranteId}`,
            );
            await safeDeductStockForPaidOrder(strapi, id, restauranteId);
            await creditLoyaltyForPaidOrder(strapi, id);
        }

        ctx.body = { data: updated };
    },

    /**
     * POST /restaurants/:slug/orders/:id/items
     * body: { productId, quantity, notes? }
     */
    async addItem(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        const orderId = Number(ctx.params.id);
        const body = ctx.request.body?.data || ctx.request.body || {};
        const productId = Number(body.productId);
        const quantity = Number(body.quantity || 1);
        const notes = body.notes || null;

        if (!productId || quantity <= 0) {
            return ctx.badRequest('productId y quantity requeridos');
        }

        const loaded = await loadStaffOrder(strapi, orderId, restauranteId);
        if (loaded.error === 'not_found') return ctx.notFound('Pedido no encontrado');
        if (loaded.error === 'forbidden') return ctx.unauthorized('Pedido de otro restaurante');
        if (loaded.error === 'not_editable') {
            return ctx.badRequest('No se pueden editar ítems de un pedido cerrado o cancelado');
        }

        const prod = await validateProductForRestaurant(strapi, productId, restauranteId);
        if (!prod) return ctx.badRequest('Producto inválido');
        if ((prod as any).error === 'unavailable') {
            return ctx.badRequest(`Producto no disponible: ${(prod as any).name}`);
        }

        const unit = Number(prod.price || 0);
        const totalPrice = unit * quantity;

        await strapi.entityService.create('api::item-pedido.item-pedido', {
            data: {
                product: productId,
                order: orderId,
                quantity,
                UnitPrice: unit,
                totalPrice,
                notes,
            },
        });

        const staffNote = `[Staff] +${quantity}x ${prod.name}`;
        const prevNotes = loaded.order?.staffNotes || '';
        await strapi.entityService.update('api::pedido.pedido', orderId, {
            data: {
                staffNotes: prevNotes ? `${prevNotes}\n${staffNote}` : staffNote,
            },
        });

        await recalculateOrderTotal(strapi, orderId);
        const full = await getFullOrder(strapi, orderId);
        ctx.body = { data: full };
    },

    /**
     * PATCH /restaurants/:slug/orders/:id/items/:itemId
     * body: { quantity?, notes? }
     */
    async updateItem(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        const orderId = Number(ctx.params.id);
        const itemId = Number(ctx.params.itemId);
        const body = ctx.request.body?.data || ctx.request.body || {};

        const loaded = await loadStaffOrder(strapi, orderId, restauranteId);
        if (loaded.error === 'not_found') return ctx.notFound('Pedido no encontrado');
        if (loaded.error === 'forbidden') return ctx.unauthorized('Pedido de otro restaurante');
        if (loaded.error === 'not_editable') {
            return ctx.badRequest('No se pueden editar ítems de un pedido cerrado o cancelado');
        }

        const item = await strapi.entityService.findOne('api::item-pedido.item-pedido', itemId, {
            fields: ['id', 'quantity', 'UnitPrice', 'notes', 'order'],
            populate: { order: { fields: ['id'] } },
        });
        if (!item?.id || String(item.order?.id || item.order) !== String(orderId)) {
            return ctx.notFound('Ítem no encontrado');
        }

        const quantity = body.quantity != null ? Number(body.quantity) : Number(item.quantity);
        if (quantity <= 0) {
            return ctx.badRequest('quantity debe ser mayor a 0');
        }

        const unit = Number(item.UnitPrice || 0);
        const data: Record<string, unknown> = {
            quantity,
            totalPrice: unit * quantity,
        };
        if (body.notes !== undefined) data.notes = body.notes;

        await strapi.entityService.update('api::item-pedido.item-pedido', itemId, { data });
        await recalculateOrderTotal(strapi, orderId);
        const full = await getFullOrder(strapi, orderId);
        ctx.body = { data: full };
    },

    /**
     * DELETE /restaurants/:slug/orders/:id/items/:itemId
     */
    async deleteItem(ctx: any) {
        const strapi: any = ctx.strapi;
        const restauranteId = ctx.state.restaurantId ?? ctx.state.restauranteId;
        const orderId = Number(ctx.params.id);
        const itemId = Number(ctx.params.itemId);

        const loaded = await loadStaffOrder(strapi, orderId, restauranteId);
        if (loaded.error === 'not_found') return ctx.notFound('Pedido no encontrado');
        if (loaded.error === 'forbidden') return ctx.unauthorized('Pedido de otro restaurante');
        if (loaded.error === 'not_editable') {
            return ctx.badRequest('No se pueden editar ítems de un pedido cerrado o cancelado');
        }

        const item = await strapi.entityService.findOne('api::item-pedido.item-pedido', itemId, {
            fields: ['id'],
            populate: { order: { fields: ['id'] }, product: { fields: ['name'] } },
        });
        if (!item?.id || String(item.order?.id || item.order) !== String(orderId)) {
            return ctx.notFound('Ítem no encontrado');
        }

        await strapi.entityService.delete('api::item-pedido.item-pedido', itemId);
        await recalculateOrderTotal(strapi, orderId);
        const full = await getFullOrder(strapi, orderId);
        ctx.body = { data: full };
    },

};
