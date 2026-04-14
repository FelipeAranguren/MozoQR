export default {
  routes: [
    // --- Stock ---
    {
      method: 'GET',
      path: '/restaurants/:slug/stock',
      handler: 'custom-stock.stockOverview',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/stock/:productoId',
      handler: 'custom-stock.ajusteStock',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/stock/alertas',
      handler: 'custom-stock.alertas',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/stock/movimientos',
      handler: 'custom-stock.movimientosStock',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    // --- Compras ---
    {
      method: 'POST',
      path: '/restaurants/:slug/compras',
      handler: 'custom-stock.crearCompra',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/compras',
      handler: 'custom-stock.listarCompras',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/compras/:id',
      handler: 'custom-stock.detalleCompra',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/compras/:id/recibir',
      handler: 'custom-stock.recibirCompra',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/compras/:id/cancelar',
      handler: 'custom-stock.cancelarCompra',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
  ],
};
