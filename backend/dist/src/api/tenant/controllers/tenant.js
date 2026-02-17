"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom tenant controller
 * Endpoints:
 *  - GET  /api/restaurants/:slug/tables
 *  - GET  /api/restaurants/:slug/tables/:number
 *  - POST /api/restaurants/:slug/tables/claim
 *  - POST /api/restaurants/:slug/tables/release
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 *  - PUT /api/restaurants/:slug/close-session
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { errors } = require('@strapi/utils');
const { ValidationError, NotFoundError } = errors;
function getPayload(raw) {
    return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}
let mesaColumnSupportCache = null;
async function getMesaColumnSupport() {
    var _a, _b;
    if (mesaColumnSupportCache)
        return mesaColumnSupportCache;
    const knex = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _a === void 0 ? void 0 : _a.connection;
    // default conservative: only fields we know existed previously
    const base = {
        activeSessionCode: false,
        occupiedAt: false,
        publishedAt: true,
        displayName: true,
        isActive: true,
    };
    if (!((_b = knex === null || knex === void 0 ? void 0 : knex.schema) === null || _b === void 0 ? void 0 : _b.hasColumn)) {
        mesaColumnSupportCache = base;
        return base;
    }
    try {
        const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
        const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');
        const hasPublishedAt = await knex.schema.hasColumn('mesas', 'published_at');
        const hasDisplayName = await knex.schema.hasColumn('mesas', 'display_name');
        const hasIsActive = await knex.schema.hasColumn('mesas', 'is_active');
        mesaColumnSupportCache = {
            activeSessionCode: !!hasActiveSessionCode,
            occupiedAt: !!hasOccupiedAt,
            publishedAt: hasPublishedAt !== false,
            displayName: hasDisplayName !== false,
            isActive: hasIsActive !== false,
        };
        return mesaColumnSupportCache;
    }
    catch (_e) {
        mesaColumnSupportCache = base;
        return base;
    }
}
/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */
async function getRestaurantBySlug(slug) {
    // Buscar todos los restaurantes con el mismo slug y usar el de ID más bajo (principal)
    const allRows = await strapi.db.query('api::restaurante.restaurante').findMany({
        where: { slug },
        select: ['id', 'documentId', 'name', 'slug'],
        orderBy: { id: 'asc' },
        limit: 10,
    });
    if (!allRows || allRows.length === 0) {
        throw new NotFoundError('Restaurante no encontrado');
    }
    // Usar el restaurante con ID más bajo (principal)
    const r = allRows[0];
    if (allRows.length > 1) {
        console.warn(`⚠️ [getRestaurantBySlug] Se encontraron ${allRows.length} restaurantes con slug "${slug}". Usando el principal (ID: ${r.id})`);
    }
    if (!(r === null || r === void 0 ? void 0 : r.id))
        throw new NotFoundError('Restaurante no encontrado');
    return { id: r.id, documentId: r.documentId, name: r.name };
}
/**
 * Get Table strictly by Number (NO auto-create).
 *
 * ✅ Mesas deben existir solo si el owner las creó.
 * ❌ Nunca crear mesas automáticamente por tráfico público.
 *
 * Uses direct DB query to avoid entityService relation filter issues.
 */
async function getMesaOrThrow(restauranteId, number) {
    var _a, _b, _c;
    const restauranteIdNum = Number(restauranteId);
    const numberNum = Number(number);
    // Validar parámetros
    if (!restauranteIdNum || isNaN(restauranteIdNum)) {
        throw new ValidationError(`ID de restaurante inválido: ${restauranteId}`);
    }
    if (!numberNum || isNaN(numberNum) || numberNum <= 0) {
        throw new ValidationError(`Número de mesa inválido: ${number}`);
    }
    const col = await getMesaColumnSupport();
    const select = ['id', 'number', 'status', 'documentId'];
    if (col.publishedAt)
        select.push('publishedAt');
    if (col.activeSessionCode)
        select.push('activeSessionCode');
    if (col.occupiedAt)
        select.push('occupiedAt');
    if (col.displayName)
        select.push('displayName');
    // Use direct DB query for more reliable relation filtering (include unpublished)
    const found = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
            restaurante: restauranteIdNum,
            number: numberNum
        },
        select,
        orderBy: { id: 'asc' } // Ordenar por ID para consistencia
    });
    if (!(found === null || found === void 0 ? void 0 : found.length)) {
        throw new NotFoundError(`Mesa ${numberNum} no configurada en este restaurante`);
    }
    if (found.length > 1) {
        // No arreglamos duplicados aquí (eso requiere migración/operación del owner),
        // pero evitamos romper el runtime: usamos la más antigua por ID y logueamos.
        console.error(`[getMesaOrThrow] ⚠️ DUPLICADO DETECTADO: ${found.length} mesas con número ${numberNum} en restaurante ${restauranteIdNum}`);
        console.error(`[getMesaOrThrow] IDs:`, found.map((m) => m.id));
    }
    const mesa = found[0];
    // Get documentId using entityService if needed (for draftAndPublish)
    let documentId = mesa.documentId;
    if (!documentId) {
        try {
            const entity = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
                fields: ['documentId'],
                publicationState: 'preview' // Include unpublished
            });
            documentId = entity === null || entity === void 0 ? void 0 : entity.documentId;
        }
        catch (err) {
            // If entityService fails, use id as fallback
            documentId = String(mesa.id);
        }
    }
    // Asegurar que la mesa esté publicada (solo si está en draft) para que sea visible en endpoints públicos.
    // No tocamos número/restaurante ni re-creamos nada.
    if (col.publishedAt && !(mesa === null || mesa === void 0 ? void 0 : mesa.publishedAt)) {
        try {
            await strapi.db.query('api::mesa.mesa').update({
                where: { id: mesa.id },
                data: {
                    publishedAt: new Date()
                }
            });
        }
        catch (err) {
            // If update fails, continue anyway
            console.warn(`[getMesaOrThrow] Could not ensure publication for mesa ${mesa.id}:`, err);
        }
    }
    return {
        id: mesa.id,
        documentId: documentId || String(mesa.id), // Fallback to id as string if documentId not available
        number: mesa.number,
        status: mesa.status,
        activeSessionCode: col.activeSessionCode ? ((_a = mesa.activeSessionCode) !== null && _a !== void 0 ? _a : null) : null,
        occupiedAt: col.occupiedAt ? ((_b = mesa.occupiedAt) !== null && _b !== void 0 ? _b : null) : null,
        displayName: (_c = mesa.displayName) !== null && _c !== void 0 ? _c : null,
    };
}
function normalizeMesaStatus(raw) {
    if (raw === 'ocupada' || raw === 'por_limpiar' || raw === 'disponible')
        return raw;
    return 'disponible';
}
function mesaToPublicDTO(mesa) {
    var _a;
    return {
        id: mesa.id,
        number: mesa.number,
        status: normalizeMesaStatus(mesa.status),
        displayName: mesa.displayName || `Mesa ${mesa.number}`,
        occupiedAt: (_a = mesa.occupiedAt) !== null && _a !== void 0 ? _a : null,
    };
}
async function getMesaRowByNumber(restauranteId, number) {
    const restauranteIdNum = Number(restauranteId);
    const numberNum = Number(number);
    const col = await getMesaColumnSupport();
    const select = ['id', 'number', 'status'];
    if (col.displayName)
        select.push('displayName');
    if (col.activeSessionCode)
        select.push('activeSessionCode');
    if (col.occupiedAt)
        select.push('occupiedAt');
    if (col.publishedAt)
        select.push('publishedAt');
    const rows = await strapi.db.query('api::mesa.mesa').findMany({
        where: { restaurante: restauranteIdNum, number: numberNum },
        select,
        orderBy: { id: 'asc' },
        limit: 1,
    });
    return (rows === null || rows === void 0 ? void 0 : rows[0]) || null;
}
async function getOrCreateOpenSessionByCode(opts) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    const { restauranteId, mesaId, code } = opts;
    console.log(`[getOrCreateOpenSessionByCode] Buscando sesión con code=${code} para mesa=${mesaId}, restaurante=${restauranteId}`);
    // First, check if there's ANY session with this code (regardless of status)
    // This is important because we might have a closed session that needs to be reopened
    const anyExisting = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: {
            code,
        },
        select: ['id', 'code', 'session_status', 'openedAt'],
        limit: 1,
    });
    if ((_a = anyExisting === null || anyExisting === void 0 ? void 0 : anyExisting[0]) === null || _a === void 0 ? void 0 : _a.id) {
        // Session exists - verify and update it to ensure it's properly associated with mesa
        const session = anyExisting[0];
        const sessionId = session.id;
        const isClosed = session.session_status !== 'open';
        console.log(`[getOrCreateOpenSessionByCode] Encontrada sesión existente con id=${sessionId}, estado=${session.session_status}${isClosed ? ' (cerrada, será reabierta)' : ''}`);
        try {
            // Get full session with relations to verify mesa association
            const fullSession = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                populate: ['mesa'],
                publicationState: 'preview',
            });
            // Check if mesa doesn't match or is missing, or if session is closed
            const currentMesaId = ((_b = fullSession === null || fullSession === void 0 ? void 0 : fullSession.mesa) === null || _b === void 0 ? void 0 : _b.id) ? Number(fullSession.mesa.id) : null;
            const expectedMesaId = Number(mesaId);
            const needsUpdate = currentMesaId !== expectedMesaId || isClosed;
            if (needsUpdate) {
                const updateReason = isClosed ? 'sesión cerrada' : `mesa incorrecta/faltante (${currentMesaId} vs ${expectedMesaId})`;
                console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} necesita actualización: ${updateReason}`);
                // Update session to ensure correct mesa and restaurante association, and reopen if closed
                // Try multiple update methods to ensure the relation is set correctly
                let updated;
                try {
                    // Method 1: entityService.update with object format
                    updated = await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sessionId, {
                        data: {
                            code: session.code || code, // Preserve existing code (required field)
                            session_status: 'open', // Always set to open
                            openedAt: isClosed ? new Date() : (fullSession.openedAt || new Date()), // New openedAt if reopening
                            closedAt: null, // Clear closedAt if it was closed
                            restaurante: { id: Number(restauranteId) },
                            mesa: { id: expectedMesaId },
                            publishedAt: new Date(),
                        },
                    });
                    console.log(`[getOrCreateOpenSessionByCode] entityService.update completado para sesión ${sessionId}${isClosed ? ' (reabierta)' : ''}`);
                }
                catch (updateErr1) {
                    console.warn(`[getOrCreateOpenSessionByCode] entityService.update con objeto falló:`, updateErr1 === null || updateErr1 === void 0 ? void 0 : updateErr1.message);
                    try {
                        // Method 2: entityService.update with direct ID
                        updated = await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sessionId, {
                            data: {
                                mesa: expectedMesaId,
                                restaurante: Number(restauranteId),
                                publishedAt: new Date(),
                            },
                        });
                        console.log(`[getOrCreateOpenSessionByCode] entityService.update con ID directo completado para sesión ${sessionId}`);
                    }
                    catch (updateErr2) {
                        console.warn(`[getOrCreateOpenSessionByCode] entityService.update con ID directo falló:`, updateErr2 === null || updateErr2 === void 0 ? void 0 : updateErr2.message);
                    }
                }
                // Re-read via entityService to verify the update worked
                const rechecked = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                    populate: ['mesa'],
                    publicationState: 'preview',
                });
                console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} después de actualizar: mesa id=${(_c = rechecked === null || rechecked === void 0 ? void 0 : rechecked.mesa) === null || _c === void 0 ? void 0 : _c.id}, mesa number=${(_d = rechecked === null || rechecked === void 0 ? void 0 : rechecked.mesa) === null || _d === void 0 ? void 0 : _d.number}`);
                if (!((_f = rechecked === null || rechecked === void 0 ? void 0 : rechecked.mesa) === null || _f === void 0 ? void 0 : _f.id)) {
                    console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión ${sessionId} todavía no tiene mesa después de actualizar. Usando Knex para actualizar foreign key directamente...`);
                    // Use Knex to update the foreign key directly on the existing session
                    const knex = (_g = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _g === void 0 ? void 0 : _g.connection;
                    if (knex) {
                        try {
                            // First, try to get column info to find the correct column name
                            let correctColumnName = null;
                            try {
                                const columnInfo = await knex('mesa_sesions').columnInfo();
                                // Look for columns that might be the mesa foreign key
                                const possibleColumnNames = Object.keys(columnInfo).filter(col => col.toLowerCase().includes('mesa') &&
                                    (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa'));
                                if (possibleColumnNames.length > 0) {
                                    correctColumnName = possibleColumnNames[0];
                                    console.log(`[getOrCreateOpenSessionByCode] Encontrada columna de foreign key: ${correctColumnName}`);
                                }
                                else {
                                    console.log(`[getOrCreateOpenSessionByCode] Columnas disponibles:`, Object.keys(columnInfo));
                                }
                            }
                            catch (infoErr) {
                                console.warn(`[getOrCreateOpenSessionByCode] No se pudo obtener info de columnas:`, infoErr === null || infoErr === void 0 ? void 0 : infoErr.message);
                            }
                            // Try different possible column names for the foreign key
                            const possibleColumns = correctColumnName ? [correctColumnName] : ['mesa_id', 'mesa', 'mesaId'];
                            let updated = false;
                            for (const colName of possibleColumns) {
                                try {
                                    await knex('mesa_sesions')
                                        .where({ id: sessionId })
                                        .update({ [colName]: expectedMesaId });
                                    console.log(`[getOrCreateOpenSessionByCode] ✅ Actualizado columna ${colName} para sesión ${sessionId} con mesa ${expectedMesaId}`);
                                    updated = true;
                                    break;
                                }
                                catch (colErr) {
                                    // Column doesn't exist or update failed, try next one
                                    console.log(`[getOrCreateOpenSessionByCode] No se pudo actualizar columna ${colName}:`, colErr === null || colErr === void 0 ? void 0 : colErr.message);
                                    continue;
                                }
                            }
                            if (updated) {
                                // Wait a bit for the update to propagate
                                await new Promise(resolve => setTimeout(resolve, 100));
                                // Re-read after Knex update
                                const knexUpdated = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                                    populate: ['mesa'],
                                    publicationState: 'preview',
                                });
                                if ((_h = knexUpdated === null || knexUpdated === void 0 ? void 0 : knexUpdated.mesa) === null || _h === void 0 ? void 0 : _h.id) {
                                    console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${sessionId} ahora tiene mesa después de actualización Knex: mesa id=${knexUpdated.mesa.id}, mesa number=${knexUpdated.mesa.number}`);
                                    return knexUpdated;
                                }
                                else {
                                    console.error(`[getOrCreateOpenSessionByCode] ❌ Sesión ${sessionId} todavía no tiene mesa después de Knex update. Mesa en respuesta:`, knexUpdated === null || knexUpdated === void 0 ? void 0 : knexUpdated.mesa);
                                }
                            }
                            else {
                                console.error(`[getOrCreateOpenSessionByCode] ❌ No se pudo actualizar ninguna columna para sesión ${sessionId}`);
                            }
                        }
                        catch (knexErr) {
                            console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, (knexErr === null || knexErr === void 0 ? void 0 : knexErr.message) || knexErr);
                        }
                    }
                    else {
                        console.error(`[getOrCreateOpenSessionByCode] ❌ Knex no disponible`);
                    }
                    // Return whatever we have (even if it doesn't have mesa)
                    console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Retornando sesión ${sessionId} sin mesa como último recurso`);
                    return rechecked || updated || fullSession;
                }
                return rechecked || updated;
            }
            // Mesa is correct, but check if session needs to be reopened
            if (isClosed) {
                console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} tiene mesa correcta (${currentMesaId}) pero está cerrada, reabriendo...`);
                try {
                    const reopened = await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sessionId, {
                        data: {
                            session_status: 'open',
                            openedAt: new Date(),
                            closedAt: null,
                            publishedAt: new Date(),
                        },
                    });
                    // Re-read to get full session with relations
                    const reopenedWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                        populate: ['mesa'],
                        publicationState: 'preview',
                    });
                    console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${sessionId} reabierta exitosamente`);
                    return reopenedWithMesa || reopened;
                }
                catch (reopenErr) {
                    console.error(`[getOrCreateOpenSessionByCode] Error reabriendo sesión ${sessionId}:`, reopenErr === null || reopenErr === void 0 ? void 0 : reopenErr.message);
                    // Return the session anyway
                    return fullSession;
                }
            }
            // Mesa is correct and session is open, return the session
            console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} ya tiene mesa correcta (${currentMesaId}) y está abierta`);
            return fullSession;
        }
        catch (err) {
            console.error(`[getOrCreateOpenSessionByCode] Error verificando/actualizando sesión ${sessionId}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            // If update fails, try to read it one more time
            try {
                const rereadAfterError = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                    populate: ['mesa'],
                    publicationState: 'preview',
                });
                if (rereadAfterError) {
                    console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} leída después del error`);
                    return rereadAfterError;
                }
            }
            catch (readErr) {
                console.error(`[getOrCreateOpenSessionByCode] Error leyendo sesión después del error:`, readErr === null || readErr === void 0 ? void 0 : readErr.message);
            }
            // Try to get the session with populated relations as fallback
            try {
                const fallbackSession = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
                    populate: ['mesa'],
                    publicationState: 'preview',
                });
                if (fallbackSession) {
                    console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} obtenida como fallback con mesa: ${((_j = fallbackSession === null || fallbackSession === void 0 ? void 0 : fallbackSession.mesa) === null || _j === void 0 ? void 0 : _j.id) || 'sin mesa'}`);
                    return fallbackSession;
                }
            }
            catch (fallbackErr) {
                console.error(`[getOrCreateOpenSessionByCode] Error obteniendo sesión como fallback:`, fallbackErr === null || fallbackErr === void 0 ? void 0 : fallbackErr.message);
            }
            // Last resort: return the session from the initial query (but it won't have mesa populated)
            console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Retornando sesión ${sessionId} sin mesa poblada como último recurso`);
            return session;
        }
    }
    // Create new "open" session with code == tableSessionId (client session token).
    console.log(`[getOrCreateOpenSessionByCode] Creando nueva sesión con code=${code}`);
    try {
        const created = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
            data: {
                code,
                session_status: 'open',
                openedAt: new Date(),
                restaurante: { id: Number(restauranteId) },
                mesa: { id: Number(mesaId) },
                publishedAt: new Date(),
            },
        });
        console.log(`[getOrCreateOpenSessionByCode] Sesión creada exitosamente: id=${created === null || created === void 0 ? void 0 : created.id}`);
        // Re-read with populated relations to ensure mesa is properly associated
        const createdWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', created.id, {
            populate: ['mesa'],
            publicationState: 'preview',
        });
        if (!((_k = createdWithMesa === null || createdWithMesa === void 0 ? void 0 : createdWithMesa.mesa) === null || _k === void 0 ? void 0 : _k.id)) {
            console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión recién creada ${created.id} no tiene mesa. Intentando actualizar con Knex...`);
            // Use Knex to update the foreign key directly
            const knex = (_l = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _l === void 0 ? void 0 : _l.connection;
            if (knex) {
                try {
                    // First, try to get column info to find the correct column name
                    let correctColumnName = null;
                    try {
                        const columnInfo = await knex('mesa_sesions').columnInfo();
                        // Look for columns that might be the mesa foreign key
                        const possibleColumnNames = Object.keys(columnInfo).filter(col => col.toLowerCase().includes('mesa') &&
                            (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa'));
                        if (possibleColumnNames.length > 0) {
                            correctColumnName = possibleColumnNames[0];
                            console.log(`[getOrCreateOpenSessionByCode] Encontrada columna de foreign key: ${correctColumnName}`);
                        }
                    }
                    catch (infoErr) {
                        console.warn(`[getOrCreateOpenSessionByCode] No se pudo obtener info de columnas:`, infoErr === null || infoErr === void 0 ? void 0 : infoErr.message);
                    }
                    // Try different possible column names for the foreign key
                    const possibleColumns = correctColumnName ? [correctColumnName] : ['mesa_id', 'mesa', 'mesaId'];
                    let updated = false;
                    for (const colName of possibleColumns) {
                        try {
                            await knex('mesa_sesions')
                                .where({ id: created.id })
                                .update({ [colName]: Number(mesaId) });
                            console.log(`[getOrCreateOpenSessionByCode] ✅ Actualizado columna ${colName} para sesión ${created.id} con mesa ${Number(mesaId)}`);
                            updated = true;
                            break;
                        }
                        catch (colErr) {
                            // Column doesn't exist or update failed, try next one
                            console.log(`[getOrCreateOpenSessionByCode] No se pudo actualizar columna ${colName}:`, colErr === null || colErr === void 0 ? void 0 : colErr.message);
                            continue;
                        }
                    }
                    if (updated) {
                        // Wait a bit for the update to propagate
                        await new Promise(resolve => setTimeout(resolve, 100));
                        // Re-read after Knex update
                        const updatedCreated = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', created.id, {
                            populate: ['mesa'],
                            publicationState: 'preview',
                        });
                        if ((_m = updatedCreated === null || updatedCreated === void 0 ? void 0 : updatedCreated.mesa) === null || _m === void 0 ? void 0 : _m.id) {
                            console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${created.id} ahora tiene mesa después de actualización Knex: mesa id=${updatedCreated.mesa.id}`);
                            return updatedCreated;
                        }
                        else {
                            console.error(`[getOrCreateOpenSessionByCode] ❌ Sesión ${created.id} todavía no tiene mesa después de Knex update`);
                        }
                    }
                    else {
                        console.error(`[getOrCreateOpenSessionByCode] ❌ No se pudo actualizar ninguna columna para sesión ${created.id}`);
                    }
                }
                catch (knexErr) {
                    console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, (knexErr === null || knexErr === void 0 ? void 0 : knexErr.message) || knexErr);
                }
            }
        }
        // Final verification and forced update if still no mesa
        if (!((_o = createdWithMesa === null || createdWithMesa === void 0 ? void 0 : createdWithMesa.mesa) === null || _o === void 0 ? void 0 : _o.id)) {
            console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión ${created.id} todavía no tiene mesa después de todos los métodos. Forzando actualización final...`);
            // Force update using entityService with direct ID
            try {
                await strapi.entityService.update('api::mesa-sesion.mesa-sesion', created.id, {
                    data: {
                        mesa: Number(mesaId),
                        restaurante: Number(restauranteId),
                    },
                });
                // Wait longer for Strapi to process the relation
                await new Promise(resolve => setTimeout(resolve, 500));
                // Re-read multiple times with different methods
                for (let attempt = 0; attempt < 3; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    // Try db.query first (more direct)
                    try {
                        const dbQueryRead = await strapi.db.query('api::mesa-sesion.mesa-sesion').findOne({
                            where: { id: created.id },
                            populate: ['mesa'],
                        });
                        if ((_p = dbQueryRead === null || dbQueryRead === void 0 ? void 0 : dbQueryRead.mesa) === null || _p === void 0 ? void 0 : _p.id) {
                            console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${created.id} tiene mesa después de forzar actualización (db.query, intento ${attempt + 1}): mesa id=${dbQueryRead.mesa.id}`);
                            return dbQueryRead;
                        }
                    }
                    catch (dbQueryErr) {
                        // Continue to next attempt
                    }
                    // Try entityService
                    try {
                        const entityRead = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', created.id, {
                            populate: ['mesa'],
                            publicationState: 'preview',
                        });
                        if ((_q = entityRead === null || entityRead === void 0 ? void 0 : entityRead.mesa) === null || _q === void 0 ? void 0 : _q.id) {
                            console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${created.id} tiene mesa después de forzar actualización (entityService, intento ${attempt + 1}): mesa id=${entityRead.mesa.id}`);
                            return entityRead;
                        }
                    }
                    catch (entityErr) {
                        // Continue to next attempt
                    }
                }
                // Verify in DB directly
                const knex = (_r = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _r === void 0 ? void 0 : _r.connection;
                if (knex) {
                    try {
                        const dbVerify = await knex('mesa_sesions')
                            .where('id', created.id)
                            .select('mesa_id')
                            .first();
                        if ((dbVerify === null || dbVerify === void 0 ? void 0 : dbVerify.mesa_id) && Number(dbVerify.mesa_id) === Number(mesaId)) {
                            console.log(`[getOrCreateOpenSessionByCode] ✅ DB confirma mesa_id=${dbVerify.mesa_id} para sesión ${created.id}. Retornando sesión aunque Strapi no la vea.`);
                            // DB has the correct value, return the session - the relation exists even if Strapi cache doesn't see it
                            // Create a mock object with mesa info for the return
                            return {
                                ...created,
                                mesa: { id: Number(mesaId) },
                            };
                        }
                    }
                    catch (dbVerifyErr) {
                        console.error(`[getOrCreateOpenSessionByCode] Error verificando DB:`, dbVerifyErr === null || dbVerifyErr === void 0 ? void 0 : dbVerifyErr.message);
                    }
                }
                // If we reach here, we couldn't establish the relation
                console.error(`[getOrCreateOpenSessionByCode] ❌ CRÍTICO: No se pudo establecer relación mesa para sesión ${created.id} después de todos los intentos`);
                throw new Error(`No se pudo establecer la relación con la mesa para la sesión ${created.id}. Por favor, intenta nuevamente.`);
            }
            catch (forceErr) {
                console.error(`[getOrCreateOpenSessionByCode] Error en actualización forzada:`, forceErr === null || forceErr === void 0 ? void 0 : forceErr.message);
                throw forceErr;
            }
        }
        return createdWithMesa || created;
    }
    catch (_e) {
        console.error(`[getOrCreateOpenSessionByCode] Error creando sesión:`, (_e === null || _e === void 0 ? void 0 : _e.message) || _e);
        // If error is "must be unique", it means a session with this code already exists
        // Search for it regardless of status and reopen/update it
        if (((_s = _e === null || _e === void 0 ? void 0 : _e.message) === null || _s === void 0 ? void 0 : _s.includes('unique')) || ((_t = _e === null || _e === void 0 ? void 0 : _e.message) === null || _t === void 0 ? void 0 : _t.includes('Unique'))) {
            console.log(`[getOrCreateOpenSessionByCode] Error de unicidad detectado, buscando sesión existente con code=${code}`);
            const existingByCode = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                where: {
                    code,
                },
                select: ['id', 'code', 'session_status', 'openedAt'],
                limit: 1,
            });
            if ((_u = existingByCode === null || existingByCode === void 0 ? void 0 : existingByCode[0]) === null || _u === void 0 ? void 0 : _u.id) {
                const existingSessionId = existingByCode[0].id;
                const isExistingClosed = existingByCode[0].session_status !== 'open';
                console.log(`[getOrCreateOpenSessionByCode] Sesión existente encontrada: id=${existingSessionId}, estado=${existingByCode[0].session_status}`);
                // Reopen and update the existing session
                try {
                    const reopened = await strapi.entityService.update('api::mesa-sesion.mesa-sesion', existingSessionId, {
                        data: {
                            session_status: 'open',
                            openedAt: isExistingClosed ? new Date() : (existingByCode[0].openedAt || new Date()),
                            closedAt: null,
                            restaurante: { id: Number(restauranteId) },
                            mesa: { id: Number(mesaId) },
                            publishedAt: new Date(),
                        },
                    });
                    // Re-read with populated relations
                    const reopenedWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', existingSessionId, {
                        populate: ['mesa'],
                        publicationState: 'preview',
                    });
                    if ((_v = reopenedWithMesa === null || reopenedWithMesa === void 0 ? void 0 : reopenedWithMesa.mesa) === null || _v === void 0 ? void 0 : _v.id) {
                        console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${existingSessionId} reabierta y actualizada exitosamente: mesa id=${reopenedWithMesa.mesa.id}`);
                        return reopenedWithMesa;
                    }
                    else {
                        console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión ${existingSessionId} reabierta pero sin mesa, usando Knex...`);
                        // Try Knex update as fallback
                        const knex = (_w = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _w === void 0 ? void 0 : _w.connection;
                        if (knex) {
                            try {
                                const columnInfo = await knex('mesa_sesions').columnInfo();
                                const possibleColumnNames = Object.keys(columnInfo).filter(col => col.toLowerCase().includes('mesa') &&
                                    (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa'));
                                const colName = possibleColumnNames[0] || 'mesa_id';
                                await knex('mesa_sesions')
                                    .where({ id: existingSessionId })
                                    .update({ [colName]: Number(mesaId) });
                                const finalCheck = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', existingSessionId, {
                                    populate: ['mesa'],
                                    publicationState: 'preview',
                                });
                                if ((_x = finalCheck === null || finalCheck === void 0 ? void 0 : finalCheck.mesa) === null || _x === void 0 ? void 0 : _x.id) {
                                    console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${existingSessionId} ahora tiene mesa después de Knex: mesa id=${finalCheck.mesa.id}`);
                                    return finalCheck;
                                }
                            }
                            catch (knexErr) {
                                console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, knexErr === null || knexErr === void 0 ? void 0 : knexErr.message);
                            }
                        }
                        return reopenedWithMesa || reopened;
                    }
                }
                catch (reopenErr) {
                    console.error(`[getOrCreateOpenSessionByCode] Error reabriendo sesión existente:`, reopenErr === null || reopenErr === void 0 ? void 0 : reopenErr.message);
                }
            }
        }
        // In case of other errors, try to re-read any open session with this code
        const reread = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
            where: {
                code,
            },
            select: ['id', 'code', 'session_status', 'openedAt'],
            limit: 1,
        });
        if ((_y = reread === null || reread === void 0 ? void 0 : reread[0]) === null || _y === void 0 ? void 0 : _y.id) {
            console.log(`[getOrCreateOpenSessionByCode] Sesión encontrada después del error: id=${reread[0].id}`);
            // Try to get it with populated relations
            try {
                const rereadWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', reread[0].id, {
                    populate: ['mesa'],
                    publicationState: 'preview',
                });
                return rereadWithMesa || reread[0];
            }
            catch (readErr) {
                console.error(`[getOrCreateOpenSessionByCode] Error leyendo sesión encontrada:`, readErr === null || readErr === void 0 ? void 0 : readErr.message);
                return reread[0];
            }
        }
        throw _e;
    }
}
async function claimTableInternal(opts) {
    var _a, _b, _c;
    const { restauranteId, tableNumber, tableSessionId } = opts;
    if (!tableSessionId)
        throw new ValidationError('Missing tableSessionId');
    const col = await getMesaColumnSupport();
    if (!col.activeSessionCode) {
        // Without active_session_code column we cannot enforce session ownership safely.
        throw new ValidationError('DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.');
    }
    const mesa = await getMesaOrThrow(restauranteId, tableNumber);
    const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
    const status = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
    const activeCode = ((_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) || null;
    console.log(`[claimTableInternal] Mesa ${tableNumber}: status=${status}, activeCode=${activeCode}, tableSessionId=${tableSessionId}`);
    // Idempotent: already claimed by same session.
    if (status === 'ocupada' && activeCode === tableSessionId) {
        console.log(`[claimTableInternal] Mesa ${tableNumber} ya está ocupada por la misma sesión`);
        return { mesaId: mesa.id, sessionId: ((_c = mesa.currentSession) === null || _c === void 0 ? void 0 : _c.id) || mesa.currentSession || null, status: 'ok' };
    }
    // Allow claiming if status is 'disponible' or 'por_limpiar'
    // Tables with 'por_limpiar' can be used by new customers even if they need cleaning
    if (status === 'disponible' || status === 'por_limpiar') {
        console.log(`[claimTableInternal] Mesa ${tableNumber} con estado ${status} - permitiendo claim`);
        // Close any lingering open sessions first (cleanup) - important for both 'disponible' and 'por_limpiar'
        // This ensures we don't have stale sessions blocking the new claim
        try {
            const openSessionsToClose = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
                filters: {
                    mesa: { id: mesa.id },
                    session_status: 'open'
                },
                fields: ['id'],
                limit: 100,
                publicationState: 'preview',
            });
            if ((openSessionsToClose === null || openSessionsToClose === void 0 ? void 0 : openSessionsToClose.length) > 0) {
                await Promise.all(openSessionsToClose.map((s) => strapi.entityService.update('api::mesa-sesion.mesa-sesion', s.id, {
                    data: {
                        session_status: 'closed',
                        closedAt: new Date(),
                        publishedAt: new Date(),
                    },
                })));
                console.log(`[claimTableInternal] Cerradas ${openSessionsToClose.length} sesiones abiertas previas para mesa ${tableNumber}`);
            }
        }
        catch (err) {
            console.warn(`[claimTableInternal] Error cerrando sesiones previas para mesa ${tableNumber}:`, err);
            // Continue anyway - will create new session
        }
        // Allow claiming to proceed - will create new session below
    }
    else if (status === 'ocupada') {
        // Also allow claiming if mesa is 'ocupada' but activeSessionCode doesn't match (stale/inconsistent data)
        // In that case, we verify there are no open sessions before allowing the claim
        console.log(`[claimTableInternal] Mesa ${tableNumber} está ocupada pero activeCode no coincide - verificando sesiones abiertas`);
        // If we reach here, activeCode doesn't match tableSessionId (or is null)
        // because if it matched, we would have returned above (line 303)
        const openSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
            where: { mesa: mesa.id, session_status: 'open' },
            select: ['id'],
            limit: 1,
        });
        if (openSessions === null || openSessions === void 0 ? void 0 : openSessions.length) {
            // There are open sessions - mesa is truly occupied
            console.log(`[claimTableInternal] Mesa ${tableNumber} tiene ${openSessions.length} sesiones abiertas - rechazando claim`);
            throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
        }
        // No open sessions - treat as available (inconsistent data or stale session)
        console.log(`[claimTableInternal] Mesa ${tableNumber} ocupada pero sin sesiones abiertas - permitiendo claim`);
        // Allow claiming to proceed
    }
    else {
        console.log(`[claimTableInternal] Mesa ${tableNumber} con estado desconocido ${status} - rechazando claim`);
        throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
    }
    // Create/open session (code == tableSessionId) then persist mesa state as source of truth.
    console.log(`[claimTableInternal] Creando/buscando sesión para mesa ${tableNumber} con code ${tableSessionId}`);
    try {
        const sesion = await getOrCreateOpenSessionByCode({ restauranteId, mesaId: mesa.id, code: tableSessionId });
        console.log(`[claimTableInternal] Sesión obtenida/creada: id=${(sesion === null || sesion === void 0 ? void 0 : sesion.id) || 'null'}`);
        console.log(`[claimTableInternal] Actualizando mesa ${tableNumber} a estado 'ocupada'`);
        await strapi.db.query('api::mesa.mesa').update({
            where: { id: mesa.id },
            data: {
                status: 'ocupada',
                activeSessionCode: tableSessionId,
                ...(col.occupiedAt ? { occupiedAt: new Date() } : {}),
                ...(col.publishedAt ? { publishedAt: new Date() } : {}),
            },
        });
        console.log(`[claimTableInternal] ✅ Mesa ${tableNumber} actualizada exitosamente`);
        return { mesaId: mesa.id, sessionId: sesion.id, status: 'ok' };
    }
    catch (err) {
        console.error(`[claimTableInternal] ❌ Error después de permitir claim para mesa ${tableNumber}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        throw err;
    }
}
async function releaseTableInternal(opts) {
    var _a, _b;
    const { restauranteId, tableNumber, tableSessionId, force = false } = opts;
    const col = await getMesaColumnSupport();
    if (!col.activeSessionCode) {
        throw new ValidationError('DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.');
    }
    const mesa = await getMesaOrThrow(restauranteId, tableNumber);
    const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
    const status = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
    const activeCode = ((_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) || null;
    // Idempotent release
    if (status === 'disponible')
        return { mesaId: mesa.id, released: true, status: 'ok' };
    if (!force) {
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        if (activeCode && tableSessionId !== activeCode) {
            throw new ValidationError('tableSessionId no coincide con la sesión activa');
        }
    }
    // Close open session(s) for this mesa.
    // When force=true (staff/owner), close ALL open sessions regardless of code.
    // When force=false, only close sessions matching activeCode for safety.
    try {
        const where = { mesa: mesa.id, session_status: 'open' };
        if (!force && activeCode)
            where.code = activeCode;
        await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
            where,
            data: { session_status: 'closed', closedAt: new Date(), publishedAt: new Date() },
        });
    }
    catch (e) {
        // ignore (mesa is still source of truth)
    }
    await strapi.db.query('api::mesa.mesa').update({
        where: { id: mesa.id },
        data: {
            status: 'disponible',
            activeSessionCode: null,
            ...(col.occupiedAt ? { occupiedAt: null } : {}),
            ...(col.publishedAt ? { publishedAt: new Date() } : {}),
        },
    });
    return { mesaId: mesa.id, released: true, status: 'ok' };
}
// NOTE: legacy helpers `setTableStatus` / `getOrCreateOpenSession` were removed in favor of:
// - `claimTableInternal` (atomic claim with tableSessionId)
// - `releaseTableInternal` (idempotent release)
// - `activeSessionCode` + `occupiedAt` persisted on `mesa` as source of truth
exports.default = {
    /**
     * GET /restaurants/:slug/tables
     * Public read-only list. Backend is the source of truth.
     */
    async listTables(ctx) {
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const restaurante = await getRestaurantBySlug(String(slug));
        console.log(`🔍 [listTables] Buscando mesas para restaurante ID: ${restaurante.id}, slug: ${slug}`);
        const col = await getMesaColumnSupport();
        const select = ['id', 'number', 'status'];
        if (col.displayName)
            select.push('displayName');
        if (col.occupiedAt)
            select.push('occupiedAt');
        // Consulta sin filtros de isActive ni publishedAt para mostrar TODAS las mesas del restaurante
        const where = {
            restaurante: Number(restaurante.id),
        };
        // NO filtrar por isActive ni publishedAt para mostrar todas las mesas
        // Las mesas sin restaurante ya están filtradas por el where anterior
        console.log(`🔍 [listTables] Query where:`, JSON.stringify(where, null, 2));
        // También hacer una consulta sin filtros para debugging
        const allMesas = await strapi.db.query('api::mesa.mesa').findMany({
            where: { restaurante: Number(restaurante.id) },
            select: ['id', 'number', 'status', 'isActive', 'publishedAt'],
            orderBy: { number: 'asc', id: 'asc' },
        });
        console.log(`🔍 [listTables] TODAS las mesas del restaurante ${restaurante.id} (sin filtros):`, allMesas.length);
        if (allMesas.length > 0) {
            console.log(`🔍 [listTables] Detalles de todas las mesas:`, allMesas.map((m) => ({
                id: m.id,
                number: m.number,
                isActive: m.isActive,
                publishedAt: m.publishedAt ? 'tiene' : 'null'
            })));
        }
        const rows = await strapi.db.query('api::mesa.mesa').findMany({
            where,
            select,
            orderBy: { number: 'asc', id: 'asc' },
        });
        console.log(`🔍 [listTables] Mesas encontradas en DB: ${(rows === null || rows === void 0 ? void 0 : rows.length) || 0}`);
        if (rows && rows.length > 0) {
            console.log(`🔍 [listTables] Primeras 3 mesas:`, rows.slice(0, 3).map((r) => ({
                id: r.id,
                number: r.number,
                status: r.status
            })));
        }
        // El filtro de restaurante ya está en el where, así que todas las mesas retornadas tienen restaurante
        const mesasConRestaurante = rows || [];
        // Defensive: if legacy data has duplicates (same number), keep the oldest by id.
        const seen = new Set();
        const deduped = mesasConRestaurante.filter((r) => {
            const n = Number(r === null || r === void 0 ? void 0 : r.number);
            if (!Number.isFinite(n))
                return false;
            if (seen.has(n))
                return false;
            seen.add(n);
            return true;
        });
        console.log(`📊 [listTables] Mesas encontradas: ${rows.length} total, ${mesasConRestaurante.length} con restaurante, ${deduped.length} únicas`);
        ctx.body = { data: deduped.map(mesaToPublicDTO) };
    },
    /**
     * GET /restaurants/:slug/tables/:number
     * Public read-only. Does NOT expose activeSessionCode.
     */
    async getTable(ctx) {
        const { slug, number } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const restaurante = await getRestaurantBySlug(String(slug));
        const col = await getMesaColumnSupport();
        const tableNumber = Number(number);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table number');
        const select = ['id', 'number', 'status'];
        if (col.displayName)
            select.push('displayName');
        if (col.occupiedAt)
            select.push('occupiedAt');
        const where = { restaurante: Number(restaurante.id), number: tableNumber };
        if (col.publishedAt)
            where.publishedAt = { $notNull: true };
        const row = await strapi.db.query('api::mesa.mesa').findOne({
            where,
            select,
        });
        if (!row)
            throw new NotFoundError('Mesa no encontrada');
        ctx.body = { data: mesaToPublicDTO(row) };
    },
    /**
     * POST /restaurants/:slug/tables/claim
     * body: { table, tableSessionId }
     *
     * Atomic at business-level: only one session can claim when AVAILABLE.
     * Idempotent: if already claimed by same tableSessionId => 200 OK.
     */
    async claimTable(ctx) {
        var _a;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = (_a = data === null || data === void 0 ? void 0 : data.table) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.number;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const tableNumber = Number(table);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table');
        try {
            const res = await claimTableInternal({ restauranteId: restaurante.id, tableNumber, tableSessionId: String(tableSessionId) });
            const row = await strapi.db.query('api::mesa.mesa').findOne({
                where: { id: Number(res.mesaId) },
                select: ['id', 'number', 'status', 'displayName', 'occupiedAt'],
            });
            ctx.body = { data: { table: row ? mesaToPublicDTO(row) : { number: tableNumber }, sessionId: res.sessionId } };
        }
        catch (e) {
            console.error(`[claimTable] Error al reclamar mesa ${tableNumber}:`, (e === null || e === void 0 ? void 0 : e.message) || e);
            const status = Number(e === null || e === void 0 ? void 0 : e.status) ||
                Number(e === null || e === void 0 ? void 0 : e.statusCode) ||
                (String((e === null || e === void 0 ? void 0 : e.name) || '').toLowerCase().includes('notfound') ? 404 : 409);
            ctx.status = status === 404 ? 404 : 409;
            ctx.body = { error: { message: (e === null || e === void 0 ? void 0 : e.message) || (ctx.status === 404 ? 'Mesa no encontrada' : 'Mesa ocupada/no disponible') } };
        }
    },
    /**
     * POST /restaurants/:slug/tables/release
     * body: { table, tableSessionId }
     *
     * Idempotent.
     */
    async releaseTable(ctx) {
        var _a;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = (_a = data === null || data === void 0 ? void 0 : data.table) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.number;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const tableNumber = Number(table);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table');
        // Public endpoint: never allow force release via body flag.
        const force = false;
        try {
            const res = await releaseTableInternal({
                restauranteId: restaurante.id,
                tableNumber,
                tableSessionId: String(tableSessionId),
                force,
            });
            const row = await strapi.db.query('api::mesa.mesa').findOne({
                where: { id: Number(res.mesaId) },
                select: ['id', 'number', 'status', 'displayName', 'occupiedAt'],
            });
            ctx.body = { data: { released: true, table: row ? mesaToPublicDTO(row) : { number: tableNumber } } };
        }
        catch (e) {
            const status = Number(e === null || e === void 0 ? void 0 : e.status) ||
                Number(e === null || e === void 0 ? void 0 : e.statusCode) ||
                (String((e === null || e === void 0 ? void 0 : e.name) || '').toLowerCase().includes('notfound') ? 404 : 409);
            ctx.status = status === 404 ? 404 : 409;
            ctx.body = { error: { message: (e === null || e === void 0 ? void 0 : e.message) || (ctx.status === 404 ? 'Mesa no encontrada' : 'No se pudo liberar la mesa') } };
        }
    },
    /**
     * POST /restaurants/:slug/orders
     */
    async createOrder(ctx) {
        var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        if (!table || items.length === 0)
            throw new ValidationError('Invalid data');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
        const mesaStatus = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
        const activeCode = (_c = (_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) !== null && _c !== void 0 ? _c : null;
        // Strict validation: backend source of truth. If mesa was released or session changed, reject.
        if (mesaStatus !== 'ocupada' || !activeCode || String(activeCode) !== String(tableSessionId)) {
            if (ctx.conflict)
                return ctx.conflict('Mesa liberada o sesión inválida');
            ctx.status = 409;
            ctx.body = { error: { message: 'Mesa liberada o sesión inválida' } };
            return;
        }
        // Ensure open session exists with code == tableSessionId
        const sesion = await getOrCreateOpenSessionByCode({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            code: String(tableSessionId),
        });
        console.log(`[createOrder] Sesión obtenida para mesa ${table}: id=${sesion === null || sesion === void 0 ? void 0 : sesion.id}, code=${(sesion === null || sesion === void 0 ? void 0 : sesion.code) || tableSessionId}`);
        // CRITICAL VALIDATION: Ensure session has mesa before creating order
        if (!(sesion === null || sesion === void 0 ? void 0 : sesion.id)) {
            throw new ValidationError('Sesión inválida: falta id');
        }
        // Verify session has mesa - re-read to ensure we have the latest state
        let sesionWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sesion.id, {
            populate: ['mesa'],
            publicationState: 'preview',
        });
        // If Strapi doesn't see mesa, check DB directly
        if (!((_d = sesionWithMesa === null || sesionWithMesa === void 0 ? void 0 : sesionWithMesa.mesa) === null || _d === void 0 ? void 0 : _d.id)) {
            console.warn(`[createOrder] ⚠️ Strapi no ve mesa en sesión ${sesion.id}, verificando DB...`);
            const knex = (_f = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _f === void 0 ? void 0 : _f.connection;
            if (knex) {
                try {
                    const dbCheck = await knex('mesa_sesions')
                        .where('id', sesion.id)
                        .select('mesa_id')
                        .first();
                    if ((dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.mesa_id) && Number(dbCheck.mesa_id) === Number(mesa.id)) {
                        console.log(`[createOrder] ✅ DB confirma mesa_id=${dbCheck.mesa_id} para sesión ${sesion.id}. Continuando...`);
                        // DB has correct value, continue
                    }
                    else {
                        console.error(`[createOrder] ❌ CRÍTICO: Sesión ${sesion.id} no tiene mesa_id correcto en DB (esperado: ${mesa.id}, encontrado: ${dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.mesa_id}). Rechazando pedido.`);
                        ctx.status = 500;
                        ctx.body = {
                            error: {
                                message: 'Error interno: la sesión no tiene mesa asociada. Por favor, intenta nuevamente.'
                            }
                        };
                        return;
                    }
                }
                catch (dbErr) {
                    console.error(`[createOrder] Error verificando DB:`, dbErr === null || dbErr === void 0 ? void 0 : dbErr.message);
                    ctx.status = 500;
                    ctx.body = {
                        error: {
                            message: 'Error interno: no se pudo verificar la sesión. Por favor, intenta nuevamente.'
                        }
                    };
                    return;
                }
            }
            else {
                console.error(`[createOrder] ❌ CRÍTICO: Sesión ${sesion.id} no tiene mesa y Knex no está disponible. Rechazando pedido.`);
                ctx.status = 500;
                ctx.body = {
                    error: {
                        message: 'Error interno: la sesión no tiene mesa asociada. Por favor, intenta nuevamente.'
                    }
                };
                return;
            }
        }
        else if (Number(sesionWithMesa.mesa.id) !== Number(mesa.id)) {
            console.error(`[createOrder] ❌ CRÍTICO: Sesión ${sesion.id} tiene mesa incorrecta (${sesionWithMesa.mesa.id} vs ${mesa.id}). Rechazando pedido.`);
            ctx.status = 500;
            ctx.body = {
                error: {
                    message: 'Error interno: la sesión está asociada a una mesa diferente. Por favor, intenta nuevamente.'
                }
            };
            return;
        }
        else {
            console.log(`[createOrder] ✅ Validación: Sesión ${sesion.id} tiene mesa correcta (${sesionWithMesa.mesa.id}, número ${sesionWithMesa.mesa.number || mesa.number})`);
        }
        // Create Order logic...
        // Normalize items and calculate total
        const normalizedItems = items.map(it => {
            var _a, _b, _c, _d;
            const q = Number((_b = (_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : it === null || it === void 0 ? void 0 : it.quantity) !== null && _b !== void 0 ? _b : 0);
            const p = Number((_d = (_c = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.price) !== null && _d !== void 0 ? _d : 0);
            const normalized = {
                quantity: q,
                unitPrice: p,
                totalPrice: q * p,
                productId: it.productId,
                notes: (it === null || it === void 0 ? void 0 : it.notes) || '',
                name: (it === null || it === void 0 ? void 0 : it.name) || '' // Preserve name for system products
            };
            return normalized;
        });
        const total = normalizedItems.reduce((s, it) => s + it.totalPrice, 0);
        // Ensure total is a valid number (not NaN)
        if (!Number.isFinite(total) || total < 0) {
            throw new ValidationError(`Invalid total calculated: ${total}. Check item prices and quantities.`);
        }
        if (!(sesion === null || sesion === void 0 ? void 0 : sesion.id)) {
            throw new ValidationError('Sesión inválida: falta id');
        }
        console.log(`[createOrder] Sesión para pedido: id=${sesion.id}, type=${typeof sesion.id}, mesaId=${mesa.id}, restauranteId=${restaurante.id}`);
        console.log(`[createOrder] Creando pedido para mesa ${table}, sesión id=${sesion.id}, restaurante id=${restaurante.id}, total=${total}`);
        // Obtener el número de mesa (preferir sesionWithMesa.mesa.number si está disponible, sino mesa.number)
        const mesaNumber = ((_g = sesionWithMesa === null || sesionWithMesa === void 0 ? void 0 : sesionWithMesa.mesa) === null || _g === void 0 ? void 0 : _g.number) || (mesa === null || mesa === void 0 ? void 0 : mesa.number) || null;
        const pedidoData = {
            order_status: 'pending',
            customerNotes: (data === null || data === void 0 ? void 0 : data.customerNotes) || '',
            total: Number(total),
            restaurante: { id: Number(restaurante.id) },
            mesa_sesion: { id: Number(sesion.id) },
            mesaNumber: mesaNumber ? Number(mesaNumber) : null,
            publishedAt: new Date(),
        };
        console.log(`[createOrder] Datos del pedido a crear:`, JSON.stringify(pedidoData, null, 2));
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: pedidoData,
        });
        console.log(`[createOrder] Pedido creado exitosamente: id=${pedido === null || pedido === void 0 ? void 0 : pedido.id}, documentId=${pedido === null || pedido === void 0 ? void 0 : pedido.documentId}`);
        // Verify the pedido was created correctly by reading it back
        try {
            const verifyPedido = await strapi.entityService.findOne('api::pedido.pedido', pedido.id, {
                populate: {
                    mesa_sesion: {
                        populate: ['mesa'],
                    },
                },
                publicationState: 'preview',
            });
            console.log(`[createOrder] Verificación: pedido id=${verifyPedido === null || verifyPedido === void 0 ? void 0 : verifyPedido.id}, mesa_sesion id=${(_h = verifyPedido === null || verifyPedido === void 0 ? void 0 : verifyPedido.mesa_sesion) === null || _h === void 0 ? void 0 : _h.id}, mesa_sesion mesa id=${(_k = (_j = verifyPedido === null || verifyPedido === void 0 ? void 0 : verifyPedido.mesa_sesion) === null || _j === void 0 ? void 0 : _j.mesa) === null || _k === void 0 ? void 0 : _k.id}, mesa_sesion mesa number=${(_m = (_l = verifyPedido === null || verifyPedido === void 0 ? void 0 : verifyPedido.mesa_sesion) === null || _l === void 0 ? void 0 : _l.mesa) === null || _m === void 0 ? void 0 : _m.number}`);
        }
        catch (verifyErr) {
            console.error(`[createOrder] Error verificando pedido creado:`, (verifyErr === null || verifyErr === void 0 ? void 0 : verifyErr.message) || verifyErr);
        }
        // Create Items with normalized values
        await Promise.all(normalizedItems.map(async (item, index) => {
            // Ensure all values are valid numbers
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            const totalPrice = quantity * unitPrice;
            if (!item.productId) {
                throw new ValidationError(`Missing productId for item at index ${index}`);
            }
            // Check if this is a system product (sys-waiter-call, sys-pay-request, etc.)
            const isSystemProduct = typeof item.productId === 'string' && item.productId.startsWith('sys-');
            // For system products, quantity and price can be 0, but still need to be valid numbers
            if (!Number.isFinite(quantity) || quantity < 0) {
                throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity}`);
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                throw new ValidationError(`Invalid unitPrice for product ${item.productId}: ${unitPrice}`);
            }
            if (!Number.isFinite(totalPrice)) {
                throw new ValidationError(`Invalid totalPrice calculated for product ${item.productId}: ${totalPrice}`);
            }
            // For system products, we don't require quantity > 0
            if (!isSystemProduct && quantity <= 0) {
                throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity} (must be > 0 for regular products)`);
            }
            try {
                // Get the product name from the item if it's a system product
                // The frontend sends 'name' field for system products
                const systemProductName = item.name || '';
                // Build notes: include system product name if it's a system product
                let itemNotes = item.notes || '';
                if (isSystemProduct && systemProductName) {
                    itemNotes = systemProductName + (itemNotes ? ` - ${itemNotes}` : '');
                }
                const itemData = {
                    quantity: quantity,
                    notes: itemNotes,
                    UnitPrice: unitPrice,
                    totalPrice: totalPrice,
                    order: pedido.id,
                    publishedAt: new Date()
                };
                // Only set product relation if it's NOT a system product
                if (!isSystemProduct) {
                    const numericProductId = Number(item.productId);
                    if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
                        throw new ValidationError(`Invalid productId: ${item.productId} (must be a positive number for regular products)`);
                    }
                    itemData.product = numericProductId;
                }
                // For system products, product field is left undefined/null (schema allows it)
                const createdItem = await strapi.entityService.create('api::item-pedido.item-pedido', {
                    data: itemData
                });
                return createdItem;
            }
            catch (err) {
                throw new ValidationError(`Failed to create item for product ${item.productId}: ${err.message}`);
            }
        }));
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST /restaurants/:slug/open-session
     *
     * REGLAS:
     * - Si ya existe sesión 'open' válida, la reutiliza (no crea duplicado)
     * - Cierra sesiones 'paid' antes de abrir nueva (transición limpia)
     * - Garantiza que mesa.status = 'ocupada' y mesa.currentSession = sessionId
     */
    async openSession(ctx) {
        var _a, _b, _c;
        try {
            const { slug } = ctx.params || {};
            // Logging detallado para diagnóstico
            console.log(`[openSession] Request recibido:`, {
                slug,
                body: ctx.request.body,
                bodyType: typeof ctx.request.body,
                hasData: 'data' in (ctx.request.body || {}),
                bodyKeys: ctx.request.body ? Object.keys(ctx.request.body) : []
            });
            // Intentar extraer el payload de múltiples formas posibles
            let data = null;
            let table = null;
            let tableSessionId = null;
            // Forma 1: body.data.table (formato Strapi estándar)
            if (((_b = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.table) !== undefined) {
                data = ctx.request.body.data;
                table = data.table;
                tableSessionId = data.tableSessionId;
                console.log(`[openSession] ✅ Table extraído de body.data.table:`, table);
            }
            // Forma 2: body.table (formato directo)
            else if (((_c = ctx.request.body) === null || _c === void 0 ? void 0 : _c.table) !== undefined) {
                data = ctx.request.body;
                table = data.table;
                tableSessionId = data.tableSessionId;
                console.log(`[openSession] ✅ Table extraído de body.table:`, table);
            }
            // Forma 3: usar getPayload helper
            else {
                data = getPayload(ctx.request.body);
                table = data === null || data === void 0 ? void 0 : data.table;
                tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
                console.log(`[openSession] Table extraído vía getPayload:`, table, `(tipo: ${typeof table})`);
            }
            // Validación más robusta del parámetro table
            if (table === undefined || table === null || table === '') {
                console.error(`[openSession] ❌ Table faltante o inválido. Body completo:`, JSON.stringify(ctx.request.body, null, 2));
                const errorMsg = `Missing or invalid table parameter. Received: ${JSON.stringify(ctx.request.body)}`;
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: errorMsg,
                        status: 400,
                        name: 'ValidationError'
                    }
                };
                return;
            }
            // Convertir a número y validar
            const tableNumber = Number(table);
            if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
                console.error(`[openSession] ❌ Table no es un número válido:`, table);
                const errorMsg = `Table must be a positive number. Received: ${table}`;
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: errorMsg,
                        status: 400,
                        name: 'ValidationError'
                    }
                };
                return;
            }
            if (!tableSessionId) {
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: 'Missing tableSessionId (cliente debe enviar su sesión para claim)',
                        status: 400,
                        name: 'ValidationError',
                    },
                };
                return;
            }
            console.log(`[openSession] Iniciando claim para mesa ${tableNumber} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            const claimed = await claimTableInternal({
                restauranteId: restaurante.id,
                tableNumber,
                tableSessionId: String(tableSessionId),
            });
            ctx.body = { data: { sessionId: claimed.sessionId, status: 'open' } };
        }
        catch (err) {
            console.error(`[openSession] ❌ Error inesperado:`, err);
            ctx.status = (err === null || err === void 0 ? void 0 : err.status) || 500;
            ctx.body = {
                error: {
                    message: (err === null || err === void 0 ? void 0 : err.message) || 'Internal server error',
                    status: ctx.status,
                    name: (err === null || err === void 0 ? void 0 : err.name) || 'Error'
                }
            };
        }
    },
    /**
     * PUT /restaurants/:slug/close-session
     *
     * REGLAS:
     * - Cierra TODAS las sesiones 'open' y 'paid' de la mesa
     * - Marca mesa.status = 'disponible' y mesa.currentSession = null
     * - NO borra sesiones (solo cambia status a 'closed')
     */
    async closeSession(ctx) {
        var _a;
        try {
            const { slug } = ctx.params || {};
            const data = getPayload(ctx.request.body);
            const table = data === null || data === void 0 ? void 0 : data.table;
            const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
            if (!table)
                throw new ValidationError('Missing table');
            // If authenticated (staff/owner), allow force release without tableSessionId.
            const user = (_a = ctx === null || ctx === void 0 ? void 0 : ctx.state) === null || _a === void 0 ? void 0 : _a.user;
            const force = !!user;
            if (!tableSessionId && !force)
                throw new ValidationError('Missing tableSessionId');
            console.log(`[closeSession] Iniciando cierre de sesión para mesa ${table} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            await releaseTableInternal({
                restauranteId: restaurante.id,
                tableNumber: Number(table),
                tableSessionId: tableSessionId ? String(tableSessionId) : null,
                force,
            });
            ctx.body = { data: { success: true } };
        }
        catch (err) {
            console.error(`[closeSession] ❌ Error:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            // Return 200 with error info to avoid generic 500 handling in browser
            ctx.body = {
                data: { success: false },
                error: `Backend Error: ${err.message}`,
                stack: err.stack
            };
        }
    },
    /**
     * POST /restaurants/:slug/close-account
     */
    async closeAccount(ctx) {
        var _a, _b, _c;
        const { slug } = ctx.params || {};
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
        const mesaStatus = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
        const activeCode = (_c = (_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) !== null && _c !== void 0 ? _c : null;
        console.log('🔍 [closeAccount] Verificando sesión:', {
            table,
            tableSessionId,
            activeCode,
            mesaId: mesa.id,
            mesaStatus,
            mesaRowActiveCode: mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode,
            mesaActiveCode: mesa.activeSessionCode,
        });
        // Verificar si tableSessionId es numérico (ID) o UUID (código)
        const isNumericSessionId = tableSessionId && !isNaN(Number(tableSessionId));
        // Si hay tableSessionId, intentar validarlo (pero ser permisivo desde el mostrador)
        if (tableSessionId) {
            let sessionFound = false;
            if (isNumericSessionId) {
                // Si es numérico, buscar por ID de sesión
                console.log('🔍 [closeAccount] tableSessionId es numérico, buscando por ID:', tableSessionId);
                const sessionById = await strapi.db.query('api::mesa-sesion.mesa-sesion').findOne({
                    where: {
                        id: Number(tableSessionId),
                        mesa: mesa.id,
                        session_status: { $in: ['open', 'paid'] }
                    }
                });
                if (sessionById) {
                    sessionFound = true;
                    console.log('✅ [closeAccount] Sesión encontrada por ID:', tableSessionId);
                }
            }
            else {
                // Si es UUID, buscar por código
                console.log('🔍 [closeAccount] tableSessionId es UUID, buscando por código:', tableSessionId);
                const sessionByCode = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                    where: {
                        mesa: mesa.id,
                        code: String(tableSessionId),
                        session_status: { $in: ['open', 'paid'] }
                    },
                    limit: 1,
                });
                if (sessionByCode && sessionByCode.length > 0) {
                    sessionFound = true;
                    console.log('✅ [closeAccount] Sesión encontrada por código:', tableSessionId);
                }
            }
            // Si no se encontró la sesión específica, verificar si hay sesiones abiertas en la mesa
            // (desde el mostrador podemos cerrar cualquier sesión de la mesa)
            if (!sessionFound) {
                console.warn('⚠️ [closeAccount] No se encontró sesión específica con tableSessionId:', tableSessionId);
                console.log('🔍 [closeAccount] Verificando si hay sesiones abiertas en la mesa...');
                const anyOpenSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                    where: {
                        mesa: mesa.id,
                        session_status: { $in: ['open', 'paid'] }
                    },
                    limit: 1,
                });
                if (anyOpenSessions && anyOpenSessions.length > 0) {
                    console.log('✅ [closeAccount] Hay sesiones abiertas en la mesa, permitiendo cierre desde mostrador');
                    // Permitir cerrar desde el mostrador
                }
                else {
                    console.warn('⚠️ [closeAccount] No hay sesiones abiertas en la mesa, pero continuando para cerrar pedidos sin pagar');
                    // Continuar de todas formas para cerrar pedidos sin pagar
                }
            }
        }
        // Find sessions (using Low Level to be safe)
        const sessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
            where: {
                mesa: mesa.id,
                session_status: { $in: ['open', 'paid'] }
            }
        });
        console.log('🔍 [closeAccount] Sesiones encontradas:', sessions.length);
        // Pay Orders & Close Sessions
        if (sessions.length > 0) {
            const sessionIds = sessions.map((s) => s.id);
            console.log('🔍 [closeAccount] Cerrando sesiones:', sessionIds);
            // Cerrar sesiones
            await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
                where: { id: { $in: sessionIds } },
                data: { session_status: 'paid', publishedAt: new Date() }
            });
            // Cerrar pedidos asociados a estas sesiones
            const pedidos = await strapi.db.query('api::pedido.pedido').findMany({
                where: {
                    mesa_sesion: { id: { $in: sessionIds } },
                    order_status: { $ne: 'paid' }
                }
            });
            console.log('🔍 [closeAccount] Pedidos encontrados para cerrar:', pedidos.length);
            if (pedidos.length > 0) {
                await strapi.db.query('api::pedido.pedido').updateMany({
                    where: { id: { $in: pedidos.map((p) => p.id) } },
                    data: { order_status: 'paid', publishedAt: new Date() }
                });
                console.log('✅ [closeAccount] Pedidos cerrados exitosamente');
            }
        }
        // Mark table as 'por_limpiar' and clear active session pointer (expulsa cliente)
        await strapi.db.query('api::mesa.mesa').update({
            where: { id: mesa.id },
            data: {
                status: 'por_limpiar',
                activeSessionCode: null,
                occupiedAt: null,
                publishedAt: new Date(),
            },
        });
        ctx.body = { data: { success: true } };
    },
    // DEBUGGING TOOL
    async debugSession(ctx) {
        const { id } = ctx.params || {};
        const tableNumber = Number(id);
        try {
            const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
                filters: { number: tableNumber },
                fields: ['id', 'documentId', 'status'],
                limit: 1,
                publicationState: 'preview'
            });
            const mesa = mesas[0];
            if (!mesa) {
                ctx.body = { error: 'Mesa not found' };
                return;
            }
            const results = {};
            results.strategyA = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                where: { mesa: mesa.id },
                select: ['id', 'session_status', 'publishedAt']
            });
            ctx.body = { mesa, results };
        }
        catch (err) {
            ctx.body = { error: err.message };
        }
    },
    /**
     * POST /restaurants/:slug/tables/force-release-all
     * Libera TODAS las mesas del restaurante (cierra sesiones, marca como disponible).
     * Requiere auth (owner/staff). No modifica pedidos.
     */
    async forceReleaseAllTables(ctx) {
        const { slug } = ctx.params || {};
        const restaurante = await getRestaurantBySlug(String(slug));
        const restauranteId = Number(restaurante.id);
        try {
            const mesas = await strapi.db.query('api::mesa.mesa').findMany({
                where: { restaurante: restauranteId },
                select: ['id', 'number'],
            });
            let released = 0;
            for (const mesa of mesas || []) {
                try {
                    await releaseTableInternal({
                        restauranteId,
                        tableNumber: mesa.number,
                        tableSessionId: null,
                        force: true,
                    });
                    released++;
                }
                catch (e) {
                    // Continuar con las demás
                }
            }
            ctx.body = { data: { released, total: (mesas === null || mesas === void 0 ? void 0 : mesas.length) || 0 }, message: `${released} mesa(s) liberada(s)` };
        }
        catch (err) {
            console.error('[forceReleaseAllTables] Error:', err === null || err === void 0 ? void 0 : err.message);
            ctx.status = 500;
            ctx.body = { error: { message: (err === null || err === void 0 ? void 0 : err.message) || 'Error liberando mesas' } };
        }
    },
    async resetTables(ctx) {
        const { slug } = ctx.params || {};
        const restaurante = await getRestaurantBySlug(String(slug));
        const restauranteId = Number(restaurante.id);
        // 🔒 Safety: never delete mesas here. This endpoint is for controlled demo/debug only.
        const allow = String(process.env.ALLOW_RESET_TABLES || '').toLowerCase() === 'true';
        const restaurantRow = await strapi.db.query('api::restaurante.restaurante').findOne({
            where: { id: restauranteId },
            select: ['id', 'is_demo'],
        });
        if (!allow || !(restaurantRow === null || restaurantRow === void 0 ? void 0 : restaurantRow.is_demo)) {
            ctx.status = 404;
            ctx.body = { error: { message: 'Not found' } };
            return;
        }
        // Close open sessions (no delete)
        await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
            where: { restaurante: restauranteId, session_status: 'open' },
            data: { session_status: 'closed', closedAt: new Date(), publishedAt: new Date() },
        });
        // Reset mesas state (no delete)
        await strapi.db.query('api::mesa.mesa').updateMany({
            where: { restaurante: restauranteId },
            data: {
                status: 'disponible',
                activeSessionCode: null,
                occupiedAt: null,
                publishedAt: new Date(),
            },
        });
        ctx.body = { message: 'Reset done (non-destructive)' };
    }
};
