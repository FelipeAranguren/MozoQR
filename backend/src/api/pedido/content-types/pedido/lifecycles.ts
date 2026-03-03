export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    // Si ya tiene mesaNumber, no hacer nada
    if (data.mesaNumber) {
      return;
    }
    
    // Si tiene mesa_sesion, obtener el número de mesa
    if (data.mesa_sesion?.id) {
      try {
        const sesion: any = await strapi.entityService.findOne(
          'api::mesa-sesion.mesa-sesion',
          data.mesa_sesion.id,
          {
            populate: ['mesa'],
            publicationState: 'preview'
          }
        );
        
        if (sesion?.mesa?.number) {
          data.mesaNumber = sesion.mesa.number;
        }
      } catch (err) {
        console.error('[pedido lifecycles] Error obteniendo mesaNumber en beforeCreate:', err);
      }
    }
  },
  
  async beforeUpdate(event: any) {
    const { data } = event.params;
    
    // Si ya tiene mesaNumber y no se está actualizando mesa_sesion, no hacer nada
    if (data.mesaNumber && !data.mesa_sesion) {
      return;
    }
    
    // Si se está actualizando la mesa_sesion, obtener el nuevo número de mesa
    if (data.mesa_sesion?.id) {
      try {
        const sesion: any = await strapi.entityService.findOne(
          'api::mesa-sesion.mesa-sesion',
          data.mesa_sesion.id,
          {
            populate: ['mesa'],
            publicationState: 'preview'
          }
        );
        
        if (sesion?.mesa?.number) {
          data.mesaNumber = sesion.mesa.number;
        }
      } catch (err) {
        console.error('[pedido lifecycles] Error obteniendo mesaNumber en beforeUpdate:', err);
      }
    }
  }
};

