// frontend/src/utils/aiInsights.js

/**
 * Utilidades para generar "insights" tipo IA basados en análisis de datos
 * Estas son reglas heurísticas que simulan inteligencia artificial
 */

/**
 * Detecta productos con baja conversión (pocas ventas)
 */
export function detectLowConversionProducts(products, orders, days = 30) {
  if (!products || !orders || products.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Contar ventas por producto en el período
  const productSales = {};
  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const items = order.items || order.item_pedidos || [];
      items.forEach(item => {
        const productId = item.product?.id || item.productId || item.product;
        if (productId) {
          productSales[productId] = (productSales[productId] || 0) + (item.quantity || item.qty || 1);
        }
      });
    });

  // Identificar productos con baja conversión
  const lowConversion = products
    .filter(product => {
      const sales = productSales[product.id] || 0;
      const isAvailable = product.available !== false;
      // Producto disponible pero con menos de 5 ventas en el período
      return isAvailable && sales < 5;
    })
    .map(product => {
      const sales = productSales[product.id] || 0;
      return {
        product,
        sales,
        recommendation: sales === 0 
          ? 'Este producto no ha tenido ventas. Considera promocionarlo o revisar su precio.'
          : 'Este producto tiene pocas ventas. Considera ajustar precio o mejorar su descripción.'
      };
    })
    .sort((a, b) => a.sales - b.sales);

  return lowConversion.slice(0, 10); // Top 10 productos con menor conversión
}

/**
 * Genera sugerencias de combos basadas en productos que se compran juntos
 */
export function suggestCombos(orders, minOccurrences = 3) {
  if (!orders || orders.length === 0) return [];

  // Analizar qué productos se compran juntos
  const productPairs = {};
  
  orders.forEach(order => {
    const items = order.items || order.item_pedidos || [];
    const productIds = items
      .map(item => item.product?.id || item.productId || item.product)
      .filter(Boolean);
    
    // Crear pares de productos del mismo pedido
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const pair = [productIds[i], productIds[j]].sort().join('-');
        productPairs[pair] = (productPairs[pair] || 0) + 1;
      }
    }
  });

  // Filtrar pares que aparecen frecuentemente
  const frequentPairs = Object.entries(productPairs)
    .filter(([_, count]) => count >= minOccurrences)
    .map(([pair, count]) => {
      const [id1, id2] = pair.split('-').map(Number);
      return { productIds: [id1, id2], occurrences: count };
    })
    .sort((a, b) => b.occurrences - a.occurrences);

  return frequentPairs.slice(0, 5); // Top 5 combos sugeridos
}

/**
 * Analiza estacionalidad (patrones por día de la semana)
 */
export function analyzeSeasonality(orders, days = 30) {
  if (!orders || orders.length === 0) return null;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const dayStats = {
    0: { name: 'Domingo', orders: 0, revenue: 0 },
    1: { name: 'Lunes', orders: 0, revenue: 0 },
    2: { name: 'Martes', orders: 0, revenue: 0 },
    3: { name: 'Miércoles', orders: 0, revenue: 0 },
    4: { name: 'Jueves', orders: 0, revenue: 0 },
    5: { name: 'Viernes', orders: 0, revenue: 0 },
    6: { name: 'Sábado', orders: 0, revenue: 0 },
  };

  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const date = new Date(order.createdAt || order.created_at);
      const dayOfWeek = date.getDay();
      dayStats[dayOfWeek].orders += 1;
      dayStats[dayOfWeek].revenue += Number(order.total || 0);
    });

  const dayStatsArray = Object.values(dayStats);
  const avgOrders = dayStatsArray.reduce((sum, d) => sum + d.orders, 0) / 7;
  const avgRevenue = dayStatsArray.reduce((sum, d) => sum + d.revenue, 0) / 7;

  const peakDay = dayStatsArray.reduce((max, day) => 
    day.orders > max.orders ? day : max
  );

  const lowDay = dayStatsArray.reduce((min, day) => 
    day.orders < min.orders ? day : min
  );

  return {
    peakDay,
    lowDay,
    averageOrders: avgOrders,
    averageRevenue: avgRevenue,
    dayStats: dayStatsArray,
    insights: [
      `Día más ocupado: ${peakDay.name} (${peakDay.orders} pedidos)`,
      `Día menos ocupado: ${lowDay.name} (${lowDay.orders} pedidos)`,
      peakDay.orders > avgOrders * 1.5 
        ? `Considera aumentar el personal los ${peakDay.name}s`
        : null,
      lowDay.orders < avgOrders * 0.7
        ? `Considera promociones especiales los ${lowDay.name}s para aumentar tráfico`
        : null
    ].filter(Boolean)
  };
}

/**
 * Genera sugerencias de menú basadas en productos populares
 */
export function suggestMenuImprovements(products, orders, days = 30) {
  if (!products || !orders || products.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Contar ventas por producto
  const productSales = {};
  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const items = order.items || order.item_pedidos || [];
      items.forEach(item => {
        const productId = item.product?.id || item.productId || item.product;
        if (productId) {
          if (!productSales[productId]) {
            productSales[productId] = { sales: 0, revenue: 0 };
          }
          const qty = item.quantity || item.qty || 1;
          const price = item.price || item.UnitPrice || 0;
          productSales[productId].sales += qty;
          productSales[productId].revenue += qty * price;
        }
      });
    });

  // Identificar productos populares sin imagen
  const popularWithoutImage = products
    .filter(product => {
      const sales = productSales[product.id]?.sales || 0;
      return sales > 10 && !product.image;
    })
    .map(product => ({
      product,
      sales: productSales[product.id]?.sales || 0,
      recommendation: 'Producto popular sin imagen. Agregar foto puede aumentar ventas.'
    }));

  // Identificar productos con buen rendimiento que podrían destacarse
  const topPerformers = Object.entries(productSales)
    .map(([productId, stats]) => {
      const product = products.find(p => p.id === Number(productId));
      if (!product) return null;
      return {
        product,
        sales: stats.sales,
        revenue: stats.revenue,
        recommendation: 'Producto estrella. Considera destacarlo en el menú o crear combos con él.'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return {
    popularWithoutImage: popularWithoutImage.slice(0, 5),
    topPerformers,
    suggestions: [
      ...popularWithoutImage.map(p => ({
        type: 'missing_image',
        priority: 'high',
        ...p
      })),
      ...topPerformers.map(p => ({
        type: 'top_performer',
        priority: 'medium',
        ...p
      }))
    ]
  };
}

/**
 * Genera un resumen de insights de IA
 */
export function generateAIInsights(products, orders, days = 30) {
  const lowConversion = detectLowConversionProducts(products, orders, days);
  const combos = suggestCombos(orders);
  const seasonality = analyzeSeasonality(orders, days);
  const menuSuggestions = suggestMenuImprovements(products, orders, days);

  return {
    lowConversion,
    combos,
    seasonality,
    menuSuggestions,
    summary: {
      totalInsights: lowConversion.length + combos.length + (seasonality?.insights?.length || 0) + menuSuggestions.suggestions.length,
      priority: lowConversion.length > 0 || menuSuggestions.popularWithoutImage.length > 0 ? 'high' : 'medium'
    }
  };
}

