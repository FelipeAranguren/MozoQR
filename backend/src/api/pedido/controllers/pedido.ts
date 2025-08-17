import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pedido.pedido', ({ strapi }) => ({

  async updateByDocumentId(ctx) {
    const { documentId } = ctx.params;
    const { data } = ctx.request.body;

    // Buscar el pedido por documentId
    const existingPedido = await strapi.db.query('api::pedido.pedido').findOne({
      where: { documentId },
    });

    if (!existingPedido) {
      return ctx.notFound('Pedido no encontrado');
    }

    // Actualizar usando el ID real
    const updatedPedido = await strapi.entityService.update('api::pedido.pedido', existingPedido.id, {
      data,
    });

    ctx.send({ data: updatedPedido });
  }

}));
