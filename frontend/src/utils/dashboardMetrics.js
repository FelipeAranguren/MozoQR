// frontend/src/utils/dashboardMetrics.js

/**
 * Calcula el Owner Success Score basado en métricas del restaurante
 */
export function calculateSuccessScore(metrics) {
  const {
    productsWithoutImage = 0,
    totalProducts = 0,
    outdatedPrices = 0,
    missingTables = 0,
    totalTables = 0,
    hasLogo = false,
    hasCategories = false,
    totalCategories = 0
  } = metrics;

  let score = 100;
  let alerts = [];

  // Penalizaciones
  if (totalProducts > 0) {
    const imageRatio = (totalProducts - productsWithoutImage) / totalProducts;
    if (imageRatio < 0.8) {
      score -= 15;
      alerts.push({
        type: 'warning',
        message: `${productsWithoutImage} productos sin foto (${Math.round((1 - imageRatio) * 100)}%)`
      });
    } else if (imageRatio < 0.95) {
      score -= 5;
    }
  }

  if (outdatedPrices > 0) {
    score -= 10;
    alerts.push({
      type: 'warning',
      message: `${outdatedPrices} productos con precios desactualizados`
    });
  }

  if (totalTables > 0 && missingTables > 0) {
    const tableRatio = (totalTables - missingTables) / totalTables;
    if (tableRatio < 0.5) {
      score -= 20;
      alerts.push({
        type: 'error',
        message: `${missingTables} mesas sin configurar`
      });
    } else if (tableRatio < 0.8) {
      score -= 10;
      alerts.push({
        type: 'warning',
        message: `${missingTables} mesas sin configurar`
      });
    }
  }

  if (!hasLogo) {
    score -= 10;
    alerts.push({
      type: 'info',
      message: 'Agrega un logo para mejorar tu presencia'
    });
  }

  if (!hasCategories || totalCategories === 0) {
    score -= 15;
    alerts.push({
      type: 'warning',
      message: 'Organiza tus productos en categorías'
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    alerts: alerts.slice(0, 5), // Máximo 5 alertas
    metrics: {
      productsWithoutImage,
      outdatedPrices,
      missingTables,
      hasLogo,
      totalCategories
    }
  };
}

/**
 * Calcula comparativa HOY vs AYER
 */
export function calculateTodayVsYesterday(ordersToday, ordersYesterday) {
  const todayTotal = ordersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const yesterdayTotal = ordersYesterday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  const diff = todayTotal - yesterdayTotal;
  const percentChange = yesterdayTotal > 0 ? ((diff / yesterdayTotal) * 100) : (todayTotal > 0 ? 100 : 0);

  return {
    today: todayTotal,
    yesterday: yesterdayTotal,
    diff,
    percentChange: Math.round(percentChange * 10) / 10
  };
}

/**
 * Calcula horas pico del negocio
 */
export function calculatePeakHours(orders) {
  const hourCounts = new Map();
  
  orders.forEach(order => {
    if (!order.createdAt) return;
    const date = new Date(order.createdAt);
    const hour = date.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  const sorted = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalOrders = orders.length || 1; // Evitar división por cero
  return sorted.map(([hour, count]) => ({
    hour: `${hour}:00`,
    count,
    percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
  }));
}

/**
 * Calcula tendencia de ventas (últimos 7 días vs anteriores 7 días)
 */
export function calculateSalesTrend(recentOrders, previousOrders) {
  const recentTotal = recentOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const previousTotal = previousOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  const diff = recentTotal - previousTotal;
  const percentChange = previousTotal > 0 ? ((diff / previousTotal) * 100) : (recentTotal > 0 ? 100 : 0);

  return {
    recent: recentTotal,
    previous: previousTotal,
    diff,
    percentChange: Math.round(percentChange * 10) / 10,
    trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable'
  };
}

