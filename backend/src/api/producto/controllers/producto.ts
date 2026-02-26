/**
 * producto controller
 */

import { factories } from '@strapi/strapi'

// Helper para resolver el ID real (numérico o documentId)
async function resolveProductId(strapi: any, param: string): Promise<number | null> {
  if (!param) return null;

  // ¿Es un número válido?
  const maybeNumber = Number(param);
  if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
    return maybeNumber;
  }

  // Tratar como documentId
  const existing = await strapi.db.query('api::producto.producto').findOne({
    where: { documentId: param as any },
    select: ['id'],
  });
  
  return existing?.id || null;
}

/** Resuelve id numérico o documentId de categoría al documentId (para Strapi 5 connect) */
async function resolveCategoriaDocumentId(strapi: any, value: number | string | null | undefined): Promise<string | null> {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  let row: { documentId?: string } | null = null;
  if (/^\d+$/.test(str)) {
    row = await strapi.db.query('api::categoria.categoria').findOne({
      where: { id: Number(str) },
      select: ['documentId'],
    });
  } else {
    const [byDoc] = await strapi.db.query('api::categoria.categoria').findMany({
      where: { documentId: str },
      select: ['documentId'],
      limit: 1,
    });
    row = byDoc ?? null;
  }
  return row?.documentId ?? null;
}

export default factories.createCoreController('api::producto.producto', ({ strapi }) => ({
  /**
   * POST /api/productos
   * Crea un producto y asegura que el restaurante esté asociado
   */
  async create(ctx) {
    console.log('🔍 [producto.create] Método create personalizado ejecutándose');
    console.log('🔍 [producto.create] Request body completo:', JSON.stringify(ctx.request?.body, null, 2));
    
    const payload = ctx.request?.body?.data || ctx.request?.body || {};
    
    console.log('🔍 [producto.create] Payload extraído:', JSON.stringify(payload, null, 2));
    console.log('🔍 [producto.create] Restaurante en payload:', payload.restaurante, 'Tipo:', typeof payload.restaurante);
    
    // Validar que el restaurante esté presente
    if (!payload.restaurante) {
      console.error('❌ [producto.create] No se proporcionó restaurante en el payload');
      console.error('❌ [producto.create] Payload completo:', payload);
      ctx.badRequest('El restaurante es requerido');
      return;
    }

    // Asegurar que restaurante sea un número
    let restauranteId = Number(payload.restaurante);
    if (isNaN(restauranteId) || restauranteId <= 0) {
      console.error('❌ [producto.create] ID de restaurante inválido:', payload.restaurante);
      ctx.badRequest('ID de restaurante inválido');
      return;
    }

    // Verificar que el restaurante exista y esté publicado
    const restaurante = await strapi.db.query('api::restaurante.restaurante').findOne({
      where: { id: restauranteId },
      select: ['id', 'slug', 'publishedAt'],
    });

    if (!restaurante) {
      console.error('❌ [producto.create] Restaurante no encontrado con ID:', restauranteId);
      ctx.notFound('Restaurante no encontrado');
      return;
    }

    // Usar siempre el restaurante con slug dado y ID más bajo (único/principal). Filtro estricto para evitar duplicados.
    const principalRows = await strapi.db.query('api::restaurante.restaurante').findMany({
      where: { slug: restaurante.slug },
      select: ['id', 'slug', 'publishedAt'],
      orderBy: { id: 'asc' },
      limit: 1,
    });
    const principalRestaurante = principalRows?.[0];
    if (principalRestaurante && principalRestaurante.id !== restauranteId) {
      restauranteId = principalRestaurante.id;
      Object.assign(restaurante, principalRestaurante);
    }

    if (!restaurante.publishedAt) {
      console.warn('⚠️ [producto.create] Restaurante encontrado pero no está publicado:', restauranteId);
      // Continuar de todas formas, pero advertir
    }

    console.log('✅ [producto.create] Restaurante verificado (final):', {
      id: restauranteId,
      slug: restaurante.slug,
      publishedAt: restaurante.publishedAt,
    });

    // Resolver categoría a documentId para Strapi 5 (relaciones con connect: [documentId])
    const rawCategoria = payload.categoria;
    const categoriaDocumentId = await resolveCategoriaDocumentId(strapi, rawCategoria);
    if (rawCategoria != null && rawCategoria !== '' && !categoriaDocumentId) {
      console.warn('⚠️ [producto.create] Categoría indicada pero no encontrada:', rawCategoria);
    }

    const finalPayload = {
      ...payload,
      restaurante: restauranteId, // Usar el ID corregido (principal)
      categoria: undefined, // No pasar crudo; usamos connect abajo
    };
    delete (finalPayload as any).categoria;

    const createData: Record<string, unknown> = {
      ...finalPayload,
      restaurante: restauranteId,
    };
    if (categoriaDocumentId) {
      createData.categoria = { connect: [categoriaDocumentId] };
    }

    console.log('🔍 [producto.create] Payload final con restaurante:', JSON.stringify(finalPayload, null, 2));
    console.log('🔍 [producto.create] Categoría (documentId):', categoriaDocumentId || '(ninguna)');

    try {
      console.log('🔍 [producto.create] Llamando a entityService.create con data (categoria connect):', JSON.stringify(createData, null, 2));

      const created = await strapi.entityService.create('api::producto.producto', {
        data: createData,
        publicationState: 'live',
      });

      console.log('✅ [producto.create] Producto creado exitosamente:', created?.id);
      console.log('🔍 [producto.create] Producto creado completo:', JSON.stringify(created, null, 2));
      
      console.log('✅ [producto.create] Producto publicado automáticamente');
      
      // Verificar que el restaurante esté asociado usando entityService
      let verifyProduct: any = await strapi.entityService.findOne('api::producto.producto', created.id, {
        populate: ['restaurante'],
        fields: ['id'],
      });

      const verifyRestauranteId = verifyProduct?.restaurante?.id || verifyProduct?.restaurante?.data?.id;
      
      if (verifyRestauranteId !== restauranteId) {
        console.warn('⚠️ [producto.create] El producto fue creado pero el restaurante no está asociado correctamente');
        console.warn('⚠️ [producto.create] Esperado:', restauranteId, 'Obtenido:', verifyRestauranteId);
        console.log('🔧 [producto.create] Intentando asociar el restaurante usando entityService.update...');
        
        // Intentar asociar el restaurante usando entityService
        try {
          await strapi.entityService.update('api::producto.producto', created.id, {
            data: {
              restaurante: restauranteId
            },
            populate: ['restaurante']
          });
          
          console.log('✅ [producto.create] Actualización de relación ejecutada, verificando...');
          
          // Verificar nuevamente
          verifyProduct = await strapi.entityService.findOne('api::producto.producto', created.id, {
            populate: ['restaurante'],
            fields: ['id'],
          });
          
          const verifyRestauranteIdAfter = verifyProduct?.restaurante?.id || verifyProduct?.restaurante?.data?.id;
          
          if (verifyRestauranteIdAfter === restauranteId) {
            console.log('✅ [producto.create] Restaurante asociado correctamente después de actualización');
          } else {
            console.error('❌ [producto.create] No se pudo asociar el restaurante incluso después de actualización');
            console.error('❌ [producto.create] Estado del producto después de actualización:', verifyProduct);
          }
        } catch (updateErr) {
          console.error('❌ [producto.create] Error al intentar asociar restaurante:', updateErr);
          console.error('❌ [producto.create] Error details:', updateErr.message, updateErr.stack);
        }
      } else {
        console.log('✅ [producto.create] Restaurante asociado correctamente al producto');
      }

      // Verificar que el producto se pueda encontrar con una consulta similar a la del menú
      console.log('🔍 [producto.create] Verificando si el producto se puede encontrar con entityService (como en el menú)...');
      try {
        const testQueryLive = await strapi.entityService.findMany('api::producto.producto', {
          filters: {
            restaurante: { id: restauranteId },
            id: created.id
          },
          publicationState: 'live',
          limit: 1,
        });
        console.log('🔍 [producto.create] entityService.findMany (live):', testQueryLive?.length || 0, 'productos encontrados');
        
        if (testQueryLive && testQueryLive.length > 0) {
          console.log('✅ [producto.create] Producto encontrado correctamente con entityService (live)');
        } else {
          console.warn('⚠️ [producto.create] Producto NO encontrado con entityService (live)');
          
          // Intentar con preview
          const testQueryPreview = await strapi.entityService.findMany('api::producto.producto', {
            filters: {
              restaurante: { id: restauranteId },
              id: created.id
            },
            publicationState: 'preview',
            limit: 1,
          });
          console.log('🔍 [producto.create] entityService.findMany (preview):', testQueryPreview?.length || 0, 'productos encontrados');
          
          if (testQueryPreview && testQueryPreview.length > 0) {
            console.log('✅ [producto.create] Producto encontrado con entityService (preview)');
          } else {
            console.error('❌ [producto.create] Producto NO encontrado ni en live ni en preview');
            console.error('❌ [producto.create] Esto indica un problema con la relación restaurante o la publicación');
          }
        }
      } catch (testErr) {
        console.error('❌ [producto.create] Error al verificar con entityService:', testErr);
      }

      // Obtener el producto completo con todas las relaciones para la respuesta
      const fullProduct = await strapi.entityService.findOne('api::producto.producto', created.id, {
        populate: ['restaurante', 'categoria', 'image'],
      });

      ctx.body = { data: fullProduct || created };
    } catch (err) {
      console.error('❌ [producto.create] Error al crear producto:', err);
      ctx.badRequest(err.message || 'Error al crear el producto');
    }
  },

  /**
   * PUT /api/productos/:id
   * - Si :id es numérico -> actualiza por id
   * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
   */
  async update(ctx) {
    const param = ctx.params?.id;
    const payload = ctx.request?.body?.data || ctx.request?.body || {};
    const payloadCopy = { ...payload };

    if (!param) {
      ctx.badRequest('Missing id param');
      return;
    }

    const realId = await resolveProductId(strapi, param);
    if (!realId) {
      ctx.notFound('Producto no encontrado');
      return;
    }

    // Strapi 5: relación categoria con connect/disconnect por documentId
    if ('categoria' in payloadCopy) {
      const rawCategoria = payloadCopy.categoria;
      const categoriaDocumentId = await resolveCategoriaDocumentId(strapi, rawCategoria);
      if (rawCategoria != null && rawCategoria !== '' && !categoriaDocumentId) {
        console.warn('⚠️ [producto.update] Categoría indicada pero no encontrada:', rawCategoria);
      }
      (payloadCopy as any).categoria = categoriaDocumentId
        ? { connect: [categoriaDocumentId] }
        : { disconnect: [true] };
    }

    const updated = await strapi.entityService.update('api::producto.producto', realId, {
      data: payloadCopy,
    });

    ctx.body = { data: updated };
  },

  /**
   * DELETE /api/productos/:id
   * - Si :id es numérico -> elimina por id
   * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
   */
  async delete(ctx) {
    const param = ctx.params?.id;

    if (!param) {
      ctx.badRequest('Missing id param');
      return;
    }

    const realId = await resolveProductId(strapi, param);
    if (!realId) {
      ctx.notFound('Producto no encontrado');
      return;
    }

    const deleted = await strapi.entityService.delete('api::producto.producto', realId);

    ctx.body = { data: deleted };
  },
}));
