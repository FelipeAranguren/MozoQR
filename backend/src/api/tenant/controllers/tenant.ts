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
type ID = number | string;

const { ValidationError, NotFoundError } = errors;

declare var strapi: any;
// Some editors in this repo run TS without node typings installed; keep this local and harmless at runtime.
declare const process: any;
declare const require: any;

type Ctx = {
  params?: Record<string, any>;
  request: { body: any };
  body?: any;
  status?: number;
  forbidden?: (message?: string) => void;
  badRequest?: (message?: string) => void;
  unauthorized?: (message?: string) => void;
  notFound?: (message?: string) => void;
  conflict?: (message?: string) => void;
  gone?: (message?: string) => void;
};

function getPayload(raw: any) {
  return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}

type MesaColumnSupport = {
  activeSessionCode: boolean;
  occupiedAt: boolean;
  publishedAt: boolean;
  displayName: boolean;
  isActive: boolean;
};

let mesaColumnSupportCache: MesaColumnSupport | null = null;

async function getMesaColumnSupport(): Promise<MesaColumnSupport> {
  if (mesaColumnSupportCache) return mesaColumnSupportCache;
  const knex = strapi?.db?.connection;
  // default conservative: only fields we know existed previously
  const base: MesaColumnSupport = {
    activeSessionCode: false,
    occupiedAt: false,
    publishedAt: true,
    displayName: true,
    isActive: true,
  };
  if (!knex?.schema?.hasColumn) {
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
  } catch (_e) {
    mesaColumnSupportCache = base;
    return base;
  }
}

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

async function getRestaurantBySlug(slug: string) {
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
  
  if (!r?.id) throw new NotFoundError('Restaurante no encontrado');
  return { id: r.id as ID, documentId: r.documentId as string, name: r.name as string };
}

/**
 * Get Table strictly by Number (NO auto-create).
 *
 * ✅ Mesas deben existir solo si el owner las creó.
 * ❌ Nunca crear mesas automáticamente por tráfico público.
 *
 * Uses direct DB query to avoid entityService relation filter issues.
 */
async function getMesaOrThrow(restauranteId: ID, number: number) {
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
  const select: string[] = ['id', 'number', 'status', 'documentId'];
  if (col.publishedAt) select.push('publishedAt');
  if (col.activeSessionCode) select.push('activeSessionCode');
  if (col.occupiedAt) select.push('occupiedAt');
  if (col.displayName) select.push('displayName');

  // Use direct DB query for more reliable relation filtering (include unpublished)
  const found = await strapi.db.query('api::mesa.mesa').findMany({
    where: {
      restaurante: restauranteIdNum,
      number: numberNum
    },
    select,
    orderBy: { id: 'asc' } // Ordenar por ID para consistencia
  });

  if (!found?.length) {
    throw new NotFoundError(`Mesa ${numberNum} no configurada en este restaurante`);
  }

  if (found.length > 1) {
    // No arreglamos duplicados aquí (eso requiere migración/operación del owner),
    // pero evitamos romper el runtime: usamos la más antigua por ID y logueamos.
    console.error(`[getMesaOrThrow] ⚠️ DUPLICADO DETECTADO: ${found.length} mesas con número ${numberNum} en restaurante ${restauranteIdNum}`);
    console.error(`[getMesaOrThrow] IDs:`, found.map((m: any) => m.id));
  }

  const mesa: any = found[0];

  // Get documentId using entityService if needed (for draftAndPublish)
  let documentId: string | undefined = (mesa as any).documentId;
  if (!documentId) {
    try {
      const entity = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
        fields: ['documentId'],
        publicationState: 'preview' // Include unpublished
      });
      documentId = entity?.documentId;
    } catch (err) {
      // If entityService fails, use id as fallback
      documentId = String(mesa.id);
    }
  }

  // Asegurar que la mesa esté publicada (solo si está en draft) para que sea visible en endpoints públicos.
  // No tocamos número/restaurante ni re-creamos nada.
  if (col.publishedAt && !mesa?.publishedAt) {
    try {
      await strapi.db.query('api::mesa.mesa').update({
        where: { id: mesa.id },
        data: {
          publishedAt: new Date()
        }
      });
    } catch (err) {
      // If update fails, continue anyway
      console.warn(`[getMesaOrThrow] Could not ensure publication for mesa ${mesa.id}:`, err);
    }
  }

  return {
    id: mesa.id,
    documentId: documentId || String(mesa.id), // Fallback to id as string if documentId not available
    number: mesa.number,
    status: mesa.status,
    activeSessionCode: col.activeSessionCode ? (mesa.activeSessionCode ?? null) : null,
    occupiedAt: col.occupiedAt ? (mesa.occupiedAt ?? null) : null,
    displayName: (mesa as any).displayName ?? null,
  };
}

function normalizeMesaStatus(raw: any): 'disponible' | 'ocupada' | 'por_limpiar' {
  if (raw === 'ocupada' || raw === 'por_limpiar' || raw === 'disponible') return raw;
  return 'disponible';
}

function mesaToPublicDTO(mesa: any) {
  return {
    id: mesa.id,
    number: mesa.number,
    status: normalizeMesaStatus(mesa.status),
    displayName: mesa.displayName || `Mesa ${mesa.number}`,
    occupiedAt: mesa.occupiedAt ?? null,
  };
}

async function getMesaRowByNumber(restauranteId: ID, number: number) {
  const restauranteIdNum = Number(restauranteId);
  const numberNum = Number(number);
  const col = await getMesaColumnSupport();
  const select: string[] = ['id', 'number', 'status'];
  if (col.displayName) select.push('displayName');
  if (col.activeSessionCode) select.push('activeSessionCode');
  if (col.occupiedAt) select.push('occupiedAt');
  if (col.publishedAt) select.push('publishedAt');
  const rows = await strapi.db.query('api::mesa.mesa').findMany({
    where: { restaurante: restauranteIdNum, number: numberNum },
    select,
    orderBy: { id: 'asc' },
    limit: 1,
  });
  return rows?.[0] || null;
}

async function getOrCreateOpenSessionByCode(opts: { restauranteId: ID; mesaId: ID; code: string }) {
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
  
  if (anyExisting?.[0]?.id) {
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
      const currentMesaId = fullSession?.mesa?.id ? Number(fullSession.mesa.id) : null;
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
        } catch (updateErr1: any) {
          console.warn(`[getOrCreateOpenSessionByCode] entityService.update con objeto falló:`, updateErr1?.message);
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
          } catch (updateErr2: any) {
            console.warn(`[getOrCreateOpenSessionByCode] entityService.update con ID directo falló:`, updateErr2?.message);
          }
        }
        
        // Re-read via entityService to verify the update worked
        const rechecked = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
          populate: ['mesa'],
          publicationState: 'preview',
        });
        
        console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} después de actualizar: mesa id=${rechecked?.mesa?.id}, mesa number=${rechecked?.mesa?.number}`);
        
        if (!rechecked?.mesa?.id) {
          console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión ${sessionId} todavía no tiene mesa después de actualizar. Usando Knex para actualizar foreign key directamente...`);
          
          // Use Knex to update the foreign key directly on the existing session
          const knex = strapi?.db?.connection;
          if (knex) {
            try {
              // First, try to get column info to find the correct column name
              let correctColumnName: string | null = null;
              try {
                const columnInfo = await knex('mesa_sesions').columnInfo();
                // Look for columns that might be the mesa foreign key
                const possibleColumnNames = Object.keys(columnInfo).filter(col => 
                  col.toLowerCase().includes('mesa') && 
                  (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa')
                );
                if (possibleColumnNames.length > 0) {
                  correctColumnName = possibleColumnNames[0];
                  console.log(`[getOrCreateOpenSessionByCode] Encontrada columna de foreign key: ${correctColumnName}`);
                } else {
                  console.log(`[getOrCreateOpenSessionByCode] Columnas disponibles:`, Object.keys(columnInfo));
                }
              } catch (infoErr: any) {
                console.warn(`[getOrCreateOpenSessionByCode] No se pudo obtener info de columnas:`, infoErr?.message);
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
                } catch (colErr: any) {
                  // Column doesn't exist or update failed, try next one
                  console.log(`[getOrCreateOpenSessionByCode] No se pudo actualizar columna ${colName}:`, colErr?.message);
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
                if (knexUpdated?.mesa?.id) {
                  console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${sessionId} ahora tiene mesa después de actualización Knex: mesa id=${knexUpdated.mesa.id}, mesa number=${knexUpdated.mesa.number}`);
                  return knexUpdated;
                } else {
                  console.error(`[getOrCreateOpenSessionByCode] ❌ Sesión ${sessionId} todavía no tiene mesa después de Knex update. Mesa en respuesta:`, knexUpdated?.mesa);
                }
              } else {
                console.error(`[getOrCreateOpenSessionByCode] ❌ No se pudo actualizar ninguna columna para sesión ${sessionId}`);
              }
            } catch (knexErr: any) {
              console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, knexErr?.message || knexErr);
            }
          } else {
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
        } catch (reopenErr: any) {
          console.error(`[getOrCreateOpenSessionByCode] Error reabriendo sesión ${sessionId}:`, reopenErr?.message);
          // Return the session anyway
          return fullSession;
        }
      }
      
      // Mesa is correct and session is open, return the session
      console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} ya tiene mesa correcta (${currentMesaId}) y está abierta`);
      return fullSession;
    } catch (err: any) {
      console.error(`[getOrCreateOpenSessionByCode] Error verificando/actualizando sesión ${sessionId}:`, err?.message || err);
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
      } catch (readErr: any) {
        console.error(`[getOrCreateOpenSessionByCode] Error leyendo sesión después del error:`, readErr?.message);
      }
      // Try to get the session with populated relations as fallback
      try {
        const fallbackSession = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sessionId, {
          populate: ['mesa'],
          publicationState: 'preview',
        });
        if (fallbackSession) {
          console.log(`[getOrCreateOpenSessionByCode] Sesión ${sessionId} obtenida como fallback con mesa: ${fallbackSession?.mesa?.id || 'sin mesa'}`);
          return fallbackSession;
        }
      } catch (fallbackErr: any) {
        console.error(`[getOrCreateOpenSessionByCode] Error obteniendo sesión como fallback:`, fallbackErr?.message);
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
    console.log(`[getOrCreateOpenSessionByCode] Sesión creada exitosamente: id=${created?.id}`);
    
    // Re-read with populated relations to ensure mesa is properly associated
    const createdWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', created.id, {
      populate: ['mesa'],
      publicationState: 'preview',
    });
    
    if (!createdWithMesa?.mesa?.id) {
      console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión recién creada ${created.id} no tiene mesa. Intentando actualizar con Knex...`);
      
      // Use Knex to update the foreign key directly
      const knex = strapi?.db?.connection;
      if (knex) {
        try {
          // First, try to get column info to find the correct column name
          let correctColumnName: string | null = null;
          try {
            const columnInfo = await knex('mesa_sesions').columnInfo();
            // Look for columns that might be the mesa foreign key
            const possibleColumnNames = Object.keys(columnInfo).filter(col => 
              col.toLowerCase().includes('mesa') && 
              (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa')
            );
            if (possibleColumnNames.length > 0) {
              correctColumnName = possibleColumnNames[0];
              console.log(`[getOrCreateOpenSessionByCode] Encontrada columna de foreign key: ${correctColumnName}`);
            }
          } catch (infoErr: any) {
            console.warn(`[getOrCreateOpenSessionByCode] No se pudo obtener info de columnas:`, infoErr?.message);
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
            } catch (colErr: any) {
              // Column doesn't exist or update failed, try next one
              console.log(`[getOrCreateOpenSessionByCode] No se pudo actualizar columna ${colName}:`, colErr?.message);
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
            
            if (updatedCreated?.mesa?.id) {
              console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${created.id} ahora tiene mesa después de actualización Knex: mesa id=${updatedCreated.mesa.id}`);
              return updatedCreated;
            } else {
              console.error(`[getOrCreateOpenSessionByCode] ❌ Sesión ${created.id} todavía no tiene mesa después de Knex update`);
            }
          } else {
            console.error(`[getOrCreateOpenSessionByCode] ❌ No se pudo actualizar ninguna columna para sesión ${created.id}`);
          }
        } catch (knexErr: any) {
          console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, knexErr?.message || knexErr);
        }
      }
    }
    
    return createdWithMesa || created;
  } catch (_e: any) {
    console.error(`[getOrCreateOpenSessionByCode] Error creando sesión:`, _e?.message || _e);
    
    // If error is "must be unique", it means a session with this code already exists
    // Search for it regardless of status and reopen/update it
    if (_e?.message?.includes('unique') || _e?.message?.includes('Unique')) {
      console.log(`[getOrCreateOpenSessionByCode] Error de unicidad detectado, buscando sesión existente con code=${code}`);
      const existingByCode = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: {
          code,
        },
        select: ['id', 'code', 'session_status', 'openedAt'],
        limit: 1,
      });
      
      if (existingByCode?.[0]?.id) {
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
          
          if (reopenedWithMesa?.mesa?.id) {
            console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${existingSessionId} reabierta y actualizada exitosamente: mesa id=${reopenedWithMesa.mesa.id}`);
            return reopenedWithMesa;
          } else {
            console.warn(`[getOrCreateOpenSessionByCode] ⚠️ Sesión ${existingSessionId} reabierta pero sin mesa, usando Knex...`);
            // Try Knex update as fallback
            const knex = strapi?.db?.connection;
            if (knex) {
              try {
                const columnInfo = await knex('mesa_sesions').columnInfo();
                const possibleColumnNames = Object.keys(columnInfo).filter(col => 
                  col.toLowerCase().includes('mesa') && 
                  (col.toLowerCase().endsWith('_id') || col.toLowerCase() === 'mesa')
                );
                const colName = possibleColumnNames[0] || 'mesa_id';
                await knex('mesa_sesions')
                  .where({ id: existingSessionId })
                  .update({ [colName]: Number(mesaId) });
                
                const finalCheck = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', existingSessionId, {
                  populate: ['mesa'],
                  publicationState: 'preview',
                });
                if (finalCheck?.mesa?.id) {
                  console.log(`[getOrCreateOpenSessionByCode] ✅ Sesión ${existingSessionId} ahora tiene mesa después de Knex: mesa id=${finalCheck.mesa.id}`);
                  return finalCheck;
                }
              } catch (knexErr: any) {
                console.error(`[getOrCreateOpenSessionByCode] Error con Knex:`, knexErr?.message);
              }
            }
            return reopenedWithMesa || reopened;
          }
        } catch (reopenErr: any) {
          console.error(`[getOrCreateOpenSessionByCode] Error reabriendo sesión existente:`, reopenErr?.message);
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
    if (reread?.[0]?.id) {
      console.log(`[getOrCreateOpenSessionByCode] Sesión encontrada después del error: id=${reread[0].id}`);
      // Try to get it with populated relations
      try {
        const rereadWithMesa = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', reread[0].id, {
          populate: ['mesa'],
          publicationState: 'preview',
        });
        return rereadWithMesa || reread[0];
      } catch (readErr: any) {
        console.error(`[getOrCreateOpenSessionByCode] Error leyendo sesión encontrada:`, readErr?.message);
        return reread[0];
      }
    }
    throw _e;
  }
}

async function claimTableInternal(opts: { restauranteId: ID; tableNumber: number; tableSessionId: string }) {
  const { restauranteId, tableNumber, tableSessionId } = opts;
  if (!tableSessionId) throw new ValidationError('Missing tableSessionId');
  const col = await getMesaColumnSupport();
  if (!col.activeSessionCode) {
    // Without active_session_code column we cannot enforce session ownership safely.
    throw new ValidationError(
      'DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.'
    );
  }

  const mesa = await getMesaOrThrow(restauranteId, tableNumber);
  const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
  const status = normalizeMesaStatus(mesaRow?.status ?? mesa.status);
  const activeCode = (mesaRow?.activeSessionCode ?? mesa.activeSessionCode) || null;

  console.log(`[claimTableInternal] Mesa ${tableNumber}: status=${status}, activeCode=${activeCode}, tableSessionId=${tableSessionId}`);

  // Idempotent: already claimed by same session.
  if (status === 'ocupada' && activeCode === tableSessionId) {
    console.log(`[claimTableInternal] Mesa ${tableNumber} ya está ocupada por la misma sesión`);
    return { mesaId: mesa.id, sessionId: (mesa as any).currentSession?.id || (mesa as any).currentSession || null, status: 'ok' as const };
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
      if (openSessionsToClose?.length > 0) {
        await Promise.all(openSessionsToClose.map((s: any) =>
          strapi.entityService.update('api::mesa-sesion.mesa-sesion', s.id, {
            data: {
              session_status: 'closed',
              closedAt: new Date(),
              publishedAt: new Date(),
            },
          })
        ));
        console.log(`[claimTableInternal] Cerradas ${openSessionsToClose.length} sesiones abiertas previas para mesa ${tableNumber}`);
      }
    } catch (err) {
      console.warn(`[claimTableInternal] Error cerrando sesiones previas para mesa ${tableNumber}:`, err);
      // Continue anyway - will create new session
    }
    // Allow claiming to proceed - will create new session below
  } else if (status === 'ocupada') {
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
    if (openSessions?.length) {
      // There are open sessions - mesa is truly occupied
      console.log(`[claimTableInternal] Mesa ${tableNumber} tiene ${openSessions.length} sesiones abiertas - rechazando claim`);
      throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
    }
    // No open sessions - treat as available (inconsistent data or stale session)
    console.log(`[claimTableInternal] Mesa ${tableNumber} ocupada pero sin sesiones abiertas - permitiendo claim`);
    // Allow claiming to proceed
  } else {
    console.log(`[claimTableInternal] Mesa ${tableNumber} con estado desconocido ${status} - rechazando claim`);
    throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
  }

  // Create/open session (code == tableSessionId) then persist mesa state as source of truth.
  console.log(`[claimTableInternal] Creando/buscando sesión para mesa ${tableNumber} con code ${tableSessionId}`);
  try {
    const sesion = await getOrCreateOpenSessionByCode({ restauranteId, mesaId: mesa.id, code: tableSessionId });
    console.log(`[claimTableInternal] Sesión obtenida/creada: id=${sesion?.id || 'null'}`);

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

    return { mesaId: mesa.id, sessionId: (sesion as any).id, status: 'ok' as const };
  } catch (err: any) {
    console.error(`[claimTableInternal] ❌ Error después de permitir claim para mesa ${tableNumber}:`, err?.message || err);
    throw err;
  }
}

async function releaseTableInternal(opts: { restauranteId: ID; tableNumber: number; tableSessionId?: string | null; force?: boolean }) {
  const { restauranteId, tableNumber, tableSessionId, force = false } = opts;
  const col = await getMesaColumnSupport();
  if (!col.activeSessionCode) {
    throw new ValidationError(
      'DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.'
    );
  }
  const mesa = await getMesaOrThrow(restauranteId, tableNumber);
  const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
  const status = normalizeMesaStatus(mesaRow?.status ?? mesa.status);
  const activeCode = (mesaRow?.activeSessionCode ?? mesa.activeSessionCode) || null;

  // Idempotent release
  if (status === 'disponible') return { mesaId: mesa.id, released: true, status: 'ok' as const };

  if (!force) {
    if (!tableSessionId) throw new ValidationError('Missing tableSessionId');
    if (activeCode && tableSessionId !== activeCode) {
      throw new ValidationError('tableSessionId no coincide con la sesión activa');
    }
  }

  // Close open session(s) for this mesa & active code (best-effort).
  try {
    const where: any = { mesa: mesa.id, session_status: 'open' };
    if (activeCode) where.code = activeCode;
    await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
      where,
      data: { session_status: 'closed', closedAt: new Date(), publishedAt: new Date() },
    });
  } catch (e) {
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

  return { mesaId: mesa.id, released: true, status: 'ok' as const };
}

// NOTE: legacy helpers `setTableStatus` / `getOrCreateOpenSession` were removed in favor of:
// - `claimTableInternal` (atomic claim with tableSessionId)
// - `releaseTableInternal` (idempotent release)
// - `activeSessionCode` + `occupiedAt` persisted on `mesa` as source of truth

export default {
  /**
   * GET /restaurants/:slug/tables
   * Public read-only list. Backend is the source of truth.
   */
  async listTables(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');

    const restaurante = await getRestaurantBySlug(String(slug));
    console.log(`🔍 [listTables] Buscando mesas para restaurante ID: ${restaurante.id}, slug: ${slug}`);
    
    const col = await getMesaColumnSupport();
    const select: string[] = ['id', 'number', 'status'];
    if (col.displayName) select.push('displayName');
    if (col.occupiedAt) select.push('occupiedAt');

    // Consulta sin filtros de isActive ni publishedAt para mostrar TODAS las mesas del restaurante
    const where: any = {
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
      console.log(`🔍 [listTables] Detalles de todas las mesas:`, allMesas.map((m: any) => ({
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

    console.log(`🔍 [listTables] Mesas encontradas en DB: ${rows?.length || 0}`);
    if (rows && rows.length > 0) {
      console.log(`🔍 [listTables] Primeras 3 mesas:`, rows.slice(0, 3).map((r: any) => ({
        id: r.id,
        number: r.number,
        status: r.status
      })));
    }

    // El filtro de restaurante ya está en el where, así que todas las mesas retornadas tienen restaurante
    const mesasConRestaurante = rows || [];

    // Defensive: if legacy data has duplicates (same number), keep the oldest by id.
    const seen = new Set<number>();
    const deduped = mesasConRestaurante.filter((r: any) => {
      const n = Number(r?.number);
      if (!Number.isFinite(n)) return false;
      if (seen.has(n)) return false;
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
  async getTable(ctx: Ctx) {
    const { slug, number } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');

    const restaurante = await getRestaurantBySlug(String(slug));
    const col = await getMesaColumnSupport();
    const tableNumber = Number(number);
    if (!Number.isFinite(tableNumber) || tableNumber <= 0) throw new ValidationError('Invalid table number');

    const select: string[] = ['id', 'number', 'status'];
    if (col.displayName) select.push('displayName');
    if (col.occupiedAt) select.push('occupiedAt');
    const where: any = { restaurante: Number(restaurante.id), number: tableNumber };
    if (col.publishedAt) where.publishedAt = { $notNull: true };

    const row = await strapi.db.query('api::mesa.mesa').findOne({
      where,
      select,
    });
    if (!row) throw new NotFoundError('Mesa no encontrada');

    ctx.body = { data: mesaToPublicDTO(row) };
  },

  /**
   * POST /restaurants/:slug/tables/claim
   * body: { table, tableSessionId }
   *
   * Atomic at business-level: only one session can claim when AVAILABLE.
   * Idempotent: if already claimed by same tableSessionId => 200 OK.
   */
  async claimTable(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');
    const data = getPayload(ctx.request.body);
    const table = data?.table ?? data?.number;
    const tableSessionId = data?.tableSessionId;
    if (!table) throw new ValidationError('Missing table');
    if (!tableSessionId) throw new ValidationError('Missing tableSessionId');

    const restaurante = await getRestaurantBySlug(String(slug));
    const tableNumber = Number(table);
    if (!Number.isFinite(tableNumber) || tableNumber <= 0) throw new ValidationError('Invalid table');

    try {
      const res = await claimTableInternal({ restauranteId: restaurante.id, tableNumber, tableSessionId: String(tableSessionId) });
      const row = await strapi.db.query('api::mesa.mesa').findOne({
        where: { id: Number(res.mesaId) },
        select: ['id', 'number', 'status', 'displayName', 'occupiedAt'],
      });
      ctx.body = { data: { table: row ? mesaToPublicDTO(row) : { number: tableNumber }, sessionId: res.sessionId } };
    } catch (e: any) {
      console.error(`[claimTable] Error al reclamar mesa ${tableNumber}:`, e?.message || e);
      const status =
        Number(e?.status) ||
        Number(e?.statusCode) ||
        (String(e?.name || '').toLowerCase().includes('notfound') ? 404 : 409);
      ctx.status = status === 404 ? 404 : 409;
      ctx.body = { error: { message: e?.message || (ctx.status === 404 ? 'Mesa no encontrada' : 'Mesa ocupada/no disponible') } };
    }
  },

  /**
   * POST /restaurants/:slug/tables/release
   * body: { table, tableSessionId }
   *
   * Idempotent.
   */
  async releaseTable(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');
    const data = getPayload(ctx.request.body);
    const table = data?.table ?? data?.number;
    const tableSessionId = data?.tableSessionId;
    if (!table) throw new ValidationError('Missing table');
    if (!tableSessionId) throw new ValidationError('Missing tableSessionId');

    const restaurante = await getRestaurantBySlug(String(slug));
    const tableNumber = Number(table);
    if (!Number.isFinite(tableNumber) || tableNumber <= 0) throw new ValidationError('Invalid table');

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
    } catch (e: any) {
      const status =
        Number(e?.status) ||
        Number(e?.statusCode) ||
        (String(e?.name || '').toLowerCase().includes('notfound') ? 404 : 409);
      ctx.status = status === 404 ? 404 : 409;
      ctx.body = { error: { message: e?.message || (ctx.status === 404 ? 'Mesa no encontrada' : 'No se pudo liberar la mesa') } };
    }
  },

  /**
   * POST /restaurants/:slug/orders
   */
  async createOrder(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');

    const data = getPayload(ctx.request.body);
    const table = data?.table;
    const tableSessionId = data?.tableSessionId;
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    if (!table || items.length === 0) throw new ValidationError('Invalid data');
    if (!tableSessionId) throw new ValidationError('Missing tableSessionId');

    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getMesaOrThrow(restaurante.id, Number(table));
    const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
    const mesaStatus = normalizeMesaStatus(mesaRow?.status ?? mesa.status);
    const activeCode = mesaRow?.activeSessionCode ?? (mesa as any).activeSessionCode ?? null;

    // Strict validation: backend source of truth. If mesa was released or session changed, reject.
    if (mesaStatus !== 'ocupada' || !activeCode || String(activeCode) !== String(tableSessionId)) {
      if (ctx.conflict) return ctx.conflict('Mesa liberada o sesión inválida');
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
    console.log(`[createOrder] Sesión obtenida para mesa ${table}: id=${sesion?.id}, code=${sesion?.code || tableSessionId}`);

    // Create Order logic...
    // Normalize items and calculate total
    const normalizedItems = items.map(it => {
      const q = Number(it?.qty ?? it?.quantity ?? 0);
      const p = Number(it?.unitPrice ?? it?.price ?? 0);
      const normalized = {
        quantity: q,
        unitPrice: p,
        totalPrice: q * p,
        productId: it.productId,
        notes: it?.notes || '',
        name: it?.name || '' // Preserve name for system products
      };
      return normalized;
    });

    const total = normalizedItems.reduce((s, it) => s + it.totalPrice, 0);

    // Ensure total is a valid number (not NaN)
    if (!Number.isFinite(total) || total < 0) {
      throw new ValidationError(`Invalid total calculated: ${total}. Check item prices and quantities.`);
    }

    if (!sesion?.id) {
      throw new ValidationError('Sesión inválida: falta id');
    }
    console.log(`[createOrder] Sesión para pedido: id=${sesion.id}, type=${typeof sesion.id}, mesaId=${mesa.id}, restauranteId=${restaurante.id}`);
    console.log(`[createOrder] Creando pedido para mesa ${table}, sesión id=${sesion.id}, restaurante id=${restaurante.id}, total=${total}`);
    
    const pedidoData = {
      order_status: 'pending',
      customerNotes: data?.customerNotes || '',
      total: Number(total),
      restaurante: { id: Number(restaurante.id) },
      mesa_sesion: { id: Number(sesion.id) },
      publishedAt: new Date(),
    };
    console.log(`[createOrder] Datos del pedido a crear:`, JSON.stringify(pedidoData, null, 2));
    
    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: pedidoData,
    });
    console.log(`[createOrder] Pedido creado exitosamente: id=${pedido?.id}, documentId=${pedido?.documentId}`);
    
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
      console.log(`[createOrder] Verificación: pedido id=${verifyPedido?.id}, mesa_sesion id=${verifyPedido?.mesa_sesion?.id}, mesa_sesion mesa id=${verifyPedido?.mesa_sesion?.mesa?.id}, mesa_sesion mesa number=${verifyPedido?.mesa_sesion?.mesa?.number}`);
    } catch (verifyErr: any) {
      console.error(`[createOrder] Error verificando pedido creado:`, verifyErr?.message || verifyErr);
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

        const itemData: any = {
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
      } catch (err: any) {
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
  async openSession(ctx: Ctx) {
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
      let data: any = null;
      let table: any = null;
      let tableSessionId: any = null;
      
      // Forma 1: body.data.table (formato Strapi estándar)
      if (ctx.request.body?.data?.table !== undefined) {
        data = ctx.request.body.data;
        table = data.table;
        tableSessionId = data.tableSessionId;
        console.log(`[openSession] ✅ Table extraído de body.data.table:`, table);
      }
      // Forma 2: body.table (formato directo)
      else if (ctx.request.body?.table !== undefined) {
        data = ctx.request.body;
        table = data.table;
        tableSessionId = data.tableSessionId;
        console.log(`[openSession] ✅ Table extraído de body.table:`, table);
      }
      // Forma 3: usar getPayload helper
      else {
        data = getPayload(ctx.request.body);
        table = data?.table;
        tableSessionId = data?.tableSessionId;
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
    } catch (err: any) {
      console.error(`[openSession] ❌ Error inesperado:`, err);
      ctx.status = err?.status || 500;
      ctx.body = { 
        error: { 
          message: err?.message || 'Internal server error',
          status: ctx.status,
          name: err?.name || 'Error'
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
  async closeSession(ctx: Ctx) {
    try {
      const { slug } = ctx.params || {};
      const data = getPayload(ctx.request.body);
      const table = data?.table;
      const tableSessionId = data?.tableSessionId;

      if (!table) throw new ValidationError('Missing table');
      // If authenticated (staff/owner), allow force release without tableSessionId.
      const user = (ctx as any)?.state?.user;
      const force = !!user;
      if (!tableSessionId && !force) throw new ValidationError('Missing tableSessionId');

      console.log(`[closeSession] Iniciando cierre de sesión para mesa ${table} en restaurante ${slug}`);

      const restaurante = await getRestaurantBySlug(String(slug));
      await releaseTableInternal({
        restauranteId: restaurante.id,
        tableNumber: Number(table),
        tableSessionId: tableSessionId ? String(tableSessionId) : null,
        force,
      });

      ctx.body = { data: { success: true } };
    } catch (err: any) {
      console.error(`[closeSession] ❌ Error:`, err?.message || err);
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
  async closeAccount(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const data = getPayload(ctx.request.body);
    const table = data?.table;
    const tableSessionId = data?.tableSessionId;

    if (!table) throw new ValidationError('Missing table');

    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getMesaOrThrow(restaurante.id, Number(table));
    const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
    const mesaStatus = normalizeMesaStatus(mesaRow?.status ?? mesa.status);
    const activeCode = mesaRow?.activeSessionCode ?? (mesa as any).activeSessionCode ?? null;

    console.log('🔍 [closeAccount] Verificando sesión:', {
      table,
      tableSessionId,
      activeCode,
      mesaId: mesa.id,
      mesaStatus,
      mesaRowActiveCode: mesaRow?.activeSessionCode,
      mesaActiveCode: (mesa as any).activeSessionCode,
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
      } else {
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
        } else {
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
      const sessionIds = sessions.map((s: any) => s.id);
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
          where: { id: { $in: pedidos.map((p: any) => p.id) } },
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
  async debugSession(ctx: Ctx) {
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

      const results: Record<string, any> = {};

      results.strategyA = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: { mesa: mesa.id },
        select: ['id', 'session_status', 'publishedAt']
      });

      ctx.body = { mesa, results };
    } catch (err: any) {
      ctx.body = { error: err.message };
    }
  },

  async resetTables(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const restaurante = await getRestaurantBySlug(String(slug));
    const restauranteId = Number(restaurante.id);

    // 🔒 Safety: never delete mesas here. This endpoint is for controlled demo/debug only.
    const allow = String(process.env.ALLOW_RESET_TABLES || '').toLowerCase() === 'true';
    const restaurantRow = await strapi.db.query('api::restaurante.restaurante').findOne({
      where: { id: restauranteId },
      select: ['id', 'is_demo'],
    });
    if (!allow || !(restaurantRow as any)?.is_demo) {
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
