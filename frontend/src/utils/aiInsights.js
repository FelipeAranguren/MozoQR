// frontend/src/utils/aiInsights.js

/**
 * Utilidades para generar "insights" tipo IA basados en análisis de datos
 * Estas son reglas heurísticas que simulan inteligencia artificial
 */

function toSafeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeText(value) {
  return toSafeString(value).toLowerCase().replace(/\s+/g, ' ');
}

function getOrderItems(order) {
  if (!order) return [];
  if (Array.isArray(order.items)) return order.items;
  if (Array.isArray(order.item_pedidos)) return order.item_pedidos;
  return [];
}

function extractItemIds(item) {
  const out = [];
  const directProduct = item?.product;
  const directProductId = item?.productId;

  if (directProduct && typeof directProduct === 'object') {
    if (directProduct.id != null) out.push(directProduct.id);
    if (directProduct.documentId != null) out.push(directProduct.documentId);
  }
  if (directProductId != null) out.push(directProductId);
  if (directProduct != null && (typeof directProduct === 'string' || typeof directProduct === 'number')) {
    out.push(directProduct);
  }

  return out.map(toSafeString).filter(Boolean);
}

function extractItemNames(item) {
  const out = [
    item?.name,
    item?.productName,
    item?.nombre,
    item?.product?.name,
    item?.product?.nombre,
  ];
  return out.map(toSafeString).filter(Boolean);
}

function buildProductCatalog(products = []) {
  const byId = new Map();
  const byName = new Map();
  const byCanonical = new Map();
  const byUniquePrice = new Map();
  const priceBuckets = new Map();
  const nameEntries = [];
  const productCanonicalByIndex = [];

  products.forEach((product, idx) => {
    const name = toSafeString(product?.name) || `Producto ${idx + 1}`;
    const canonical = `name:${normalizeText(name)}`;

    if (!byCanonical.has(canonical)) {
      byCanonical.set(canonical, { name, product });
    }

    const ids = [product?.id, product?.documentId].map(toSafeString).filter(Boolean);
    ids.forEach((id) => byId.set(`id:${id}`, canonical));

    const nameKey = `name:${normalizeText(name)}`;
    byName.set(nameKey, canonical);
    nameEntries.push({
      canonical,
      normalizedName: normalizeText(name),
      displayName: name,
    });

    const price = Number(product?.price);
    if (Number.isFinite(price) && price > 0) {
      const priceKey = `price:${price.toFixed(2)}`;
      const arr = priceBuckets.get(priceKey) || [];
      arr.push(canonical);
      priceBuckets.set(priceKey, arr);
    }
    productCanonicalByIndex[idx] = canonical;
  });

  for (const [priceKey, canonicals] of priceBuckets.entries()) {
    if (canonicals.length === 1) byUniquePrice.set(priceKey, canonicals[0]);
  }

  return { byId, byName, byCanonical, byUniquePrice, nameEntries, productCanonicalByIndex };
}

function extractItemUnitPrice(item) {
  const candidates = [
    item?.unitPrice,
    item?.UnitPrice,
    item?.price,
    item?.totalPrice,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function findProductByName(products = [], name = '') {
  const target = normalizeText(name);
  if (!target) return null;
  return products.find((p) => normalizeText(p?.name) === target) || null;
}

function calculateProductStats(products, orders, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const catalog = buildProductCatalog(products);
  const stats = new Map();
  let totalQty = 0;
  let totalRevenue = 0;

  (orders || [])
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach((order) => {
      const items = getOrderItems(order);
      items.forEach((item) => {
        const canonical = resolveItemCanonical(item, catalog, false);
        if (!canonical) return;
        const qty = Number(item.quantity || item.qty || 1);
        const row = stats.get(canonical) || { qty: 0, revenue: 0 };
        row.qty += qty;
        const fallbackPrice = Number(catalog.byCanonical.get(canonical)?.product?.price || 0);
        const unitPrice = Number(item.price || item.UnitPrice || item.unitPrice || 0) || fallbackPrice;
        row.revenue += unitPrice * qty;
        stats.set(canonical, row);
        totalQty += qty;
        totalRevenue += unitPrice * qty;
      });
    });

  return { stats, totalQty, totalRevenue, catalog };
}

function resolveItemCanonical(item, catalog, allowUnknownByName = false) {
  if (!item || !catalog) return null;

  const idCandidates = extractItemIds(item);
  for (const id of idCandidates) {
    const key = catalog.byId.get(`id:${id}`);
    if (key) return key;
  }

  const nameCandidates = extractItemNames(item);
  for (const name of nameCandidates) {
    const key = catalog.byName.get(`name:${normalizeText(name)}`);
    if (key) return key;
  }

  // Fallback difuso para nombres con sufijos/prefijos (ej: "Big Mac Combo")
  for (const name of nameCandidates) {
    const n = normalizeText(name);
    if (!n || n.length < 4) continue;
    const fuzzy = (catalog.nameEntries || []).find((entry) => {
      const ref = entry.normalizedName;
      if (!ref || ref.length < 4) return false;
      return n.includes(ref) || ref.includes(n);
    });
    if (fuzzy?.canonical) return fuzzy.canonical;
  }

  // Fallback por precio unitario cuando es unívoco en el catálogo
  const unitPrice = extractItemUnitPrice(item);
  if (unitPrice != null) {
    const priceKey = `price:${unitPrice.toFixed(2)}`;
    const key = catalog.byUniquePrice.get(priceKey);
    if (key) return key;
  }

  if (allowUnknownByName && nameCandidates.length > 0) {
    return `name:${normalizeText(nameCandidates[0])}`;
  }

  return null;
}

/**
 * Detecta productos con baja conversión (pocas ventas)
 */
export function detectLowConversionProducts(products, orders, days = 30) {
  if (!products || !orders || products.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const catalog = buildProductCatalog(products);

  // Contar ventas por producto en el período
  const productSales = {};
  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const items = getOrderItems(order);
      items.forEach(item => {
        const canonical = resolveItemCanonical(item, catalog, false);
        if (canonical) {
          productSales[canonical] = (productSales[canonical] || 0) + Number(item.quantity || item.qty || 1);
        }
      });
    });

  // Identificar baja conversión en forma relativa + absoluta
  const availableRows = products
    .map((product, idx) => {
      const canonical = catalog.productCanonicalByIndex[idx];
      const sales = productSales[canonical] || 0;
      return {
        product,
        sales,
        isAvailable: product.available !== false,
      };
    })
    .filter((row) => row.isAvailable);

  const totalSales = availableRows.reduce((sum, row) => sum + Number(row.sales || 0), 0);
  const avgSales = availableRows.length > 0 ? totalSales / availableRows.length : 0;
  const relativeThreshold = Math.max(3, avgSales * 0.35); // bajo respecto al promedio
  const shareThreshold = 0.08; // <8% de participación en unidades

  const lowConversion = availableRows
    .filter((row) => {
      const sales = Number(row.sales || 0);
      const share = totalSales > 0 ? sales / totalSales : 0;
      if (sales === 0) return true;
      if (sales <= relativeThreshold) return true;
      if (totalSales > 0 && share <= shareThreshold) return true;
      return false;
    })
    .map((row) => {
      const sales = Number(row.sales || 0);
      const share = totalSales > 0 ? (sales / totalSales) : 0;
      const recommendation = sales === 0
        ? 'Este producto no ha tenido ventas. Considera promocionarlo o revisar su precio.'
        : `Este producto tiene baja participación (${Math.round(share * 100)}%). Evalúa precio, visibilidad o combo.`;
      return {
        product: row.product,
        sales,
        share,
        days,
        recommendation,
      };
    })
    .sort((a, b) => a.sales - b.sales);

  return lowConversion.slice(0, 10); // Top 10 productos con menor conversión
}

/**
 * Genera sugerencias de combos basadas en productos que se compran juntos
 */
export function suggestCombos(orders, products = [], minOccurrences = 3, days = 30) {
  if (!orders || orders.length === 0) return [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const catalog = buildProductCatalog(products);

  // Analizar qué productos se compran juntos
  const productPairs = {};
  const displayNameByCanonical = new Map();
  
  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const items = getOrderItems(order);
      const productKeys = Array.from(new Set(
        items
          .map((item) => {
            const canonical = resolveItemCanonical(item, catalog, true);
            if (!canonical) return null;

            if (!displayNameByCanonical.has(canonical)) {
              const inferredName = extractItemNames(item)[0] || canonical.replace(/^name:/, '');
              displayNameByCanonical.set(canonical, inferredName);
            }
            return canonical;
          })
          .filter(Boolean)
      ));
    
      // Crear pares de productos del mismo pedido
      for (let i = 0; i < productKeys.length; i++) {
        for (let j = i + 1; j < productKeys.length; j++) {
          const pair = [productKeys[i], productKeys[j]].sort().join('||');
          productPairs[pair] = (productPairs[pair] || 0) + 1;
        }
      }
    });

  // Filtrar pares que aparecen frecuentemente
  const frequentPairs = Object.entries(productPairs)
    .filter(([_, count]) => count >= minOccurrences)
    .map(([pair, count]) => {
      const [k1, k2] = pair.split('||');
      const n1 = catalog.byCanonical.get(k1)?.name || displayNameByCanonical.get(k1) || k1;
      const n2 = catalog.byCanonical.get(k2)?.name || displayNameByCanonical.get(k2) || k2;
      return {
        productKeys: [k1, k2],
        productNames: [n1, n2],
        occurrences: count,
      };
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

export function buildAIDiagnostics(products, orders, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const catalog = buildProductCatalog(products || []);

  let totalItems = 0;
  let matchedItems = 0;
  const unmatchedNames = new Map();

  (orders || [])
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach((order) => {
      const items = getOrderItems(order);
      items.forEach((item) => {
        totalItems += 1;
        const canonical = resolveItemCanonical(item, catalog, false);
        if (canonical) {
          matchedItems += 1;
          return;
        }
        const rawName = extractItemNames(item)[0] || 'sin-nombre';
        unmatchedNames.set(rawName, (unmatchedNames.get(rawName) || 0) + 1);
      });
    });

  const unmatchedSample = Array.from(unmatchedNames.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalItems,
    matchedItems,
    unmatchedItems: Math.max(0, totalItems - matchedItems),
    matchRate: totalItems > 0 ? matchedItems / totalItems : 1,
    unmatchedSample,
  };
}

/**
 * Genera sugerencias de menú basadas en productos populares
 */
export function suggestMenuImprovements(products, orders, days = 30) {
  if (!products || !orders || products.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const catalog = buildProductCatalog(products);

  // Contar ventas por producto
  const productSales = {};
  orders
    .filter(order => new Date(order.createdAt || order.created_at) >= cutoffDate)
    .forEach(order => {
      const items = getOrderItems(order);
      items.forEach(item => {
        const canonical = resolveItemCanonical(item, catalog, false);
        if (canonical) {
          if (!productSales[canonical]) {
            productSales[canonical] = { sales: 0, revenue: 0 };
          }
          const qty = item.quantity || item.qty || 1;
          const unitPrice = Number(item.price || item.UnitPrice || item.unitPrice || item.totalPrice || 0);
          productSales[canonical].sales += qty;
          productSales[canonical].revenue += unitPrice * qty;
        }
      });
    });

  // Identificar productos populares sin imagen
  const popularWithoutImage = products
    .filter((product, idx) => {
      const canonical = catalog.productCanonicalByIndex[idx];
      const sales = productSales[canonical]?.sales || 0;
      return sales > 10 && !product.image;
    })
    .map((product, idx) => {
      const canonical = catalog.productCanonicalByIndex[idx];
      return ({
      product,
      sales: productSales[canonical]?.sales || 0,
      recommendation: 'Producto popular sin imagen. Agregar foto puede aumentar ventas.'
    });
    });

  // Identificar productos con buen rendimiento que podrían destacarse
  const topPerformers = products
    .map((product, idx) => {
      const canonical = catalog.productCanonicalByIndex[idx];
      const stats = productSales[canonical] || { sales: 0, revenue: 0 };
      if (stats.sales <= 0) return null;
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

function buildStrategicInsights(products, orders, days, base) {
  const { combos, seasonality, diagnostics, menuSuggestions } = base;
  const { stats, totalQty } = calculateProductStats(products, orders, days);
  const opportunities = [];
  const risks = [];

  if (Array.isArray(combos) && combos.length > 0) {
    const topCombo = combos[0];
    opportunities.push({
      title: 'Lanzar combo ganador',
      detail: `${topCombo.productNames?.[0] || 'Producto A'} + ${topCombo.productNames?.[1] || 'Producto B'} aparece ${topCombo.occurrences} veces juntos.`,
      action: 'Crear promo de combo por 14 dias',
      priority: 'alta',
    });
  }

  if (menuSuggestions?.popularWithoutImage?.length > 0) {
    const p = menuSuggestions.popularWithoutImage[0];
    opportunities.push({
      title: 'Mejorar conversion visual',
      detail: `${p?.product?.name || 'Producto'} vende bien pero no tiene imagen (${p?.sales || 0} ventas).`,
      action: 'Subir foto principal del producto',
      priority: 'media',
    });
  }

  if (Array.isArray(menuSuggestions?.topPerformers) && menuSuggestions.topPerformers.length > 0) {
    const star = menuSuggestions.topPerformers[0];
    opportunities.push({
      title: 'Empujar producto estrella',
      detail: `${star.product?.name || 'Producto'} lidera con ${star.sales} ventas.`,
      action: 'Destacarlo en portada y upsell',
      priority: 'media',
    });
  }

  if ((diagnostics?.matchRate || 1) < 0.9) {
    risks.push({
      title: 'Calidad de datos incompleta',
      detail: `Cobertura de match en ${Math.round((diagnostics.matchRate || 0) * 100)}%.`,
      impact: 'Puede ocultar ventas reales en algunos insights.',
      severity: (diagnostics.matchRate || 0) < 0.7 ? 'alta' : 'media',
    });
  }

  const topByQty = Array.from(stats.entries()).sort((a, b) => b[1].qty - a[1].qty)[0];
  if (topByQty && totalQty > 0) {
    const share = topByQty[1].qty / totalQty;
    if (share >= 0.45) {
      const name = base?.menuSuggestions?.topPerformers?.[0]?.product?.name
        || base?.combos?.[0]?.productNames?.[0]
        || 'producto líder';
      risks.push({
        title: 'Dependencia de un solo producto',
        detail: `${name} concentra ${Math.round(share * 100)}% del volumen.`,
        impact: 'Riesgo ante quiebre de stock o cambios de demanda.',
        severity: share >= 0.6 ? 'alta' : 'media',
      });
    }
  }

  if (seasonality?.averageOrders > 0 && seasonality?.lowDay?.orders <= seasonality.averageOrders * 0.6) {
    risks.push({
      title: 'Franja de baja demanda marcada',
      detail: `${seasonality.lowDay.name} está muy por debajo del promedio semanal.`,
      impact: 'Pérdida de ingreso por capacidad ociosa.',
      severity: 'media',
    });
  }

  let comboSimulator = null;
  if (Array.isArray(combos) && combos.length > 0) {
    const c = combos[0];
    const n1 = c.productNames?.[0];
    const n2 = c.productNames?.[1];
    const p1 = findProductByName(products, n1);
    const p2 = findProductByName(products, n2);
    const basePrice = Number(p1?.price || 0) + Number(p2?.price || 0);
    const comboPrice = basePrice > 0 ? Math.round((basePrice * 0.92) * 100) / 100 : 0;
    const monthlyOccurrences = Math.max(0, Math.round((c.occurrences || 0) * (30 / Math.max(30, days))));
    const adoptionRate = 0.15;
    const estimatedCombos = Math.round(monthlyOccurrences * adoptionRate);
    const projectedRevenue = Math.round(estimatedCombos * comboPrice);

    comboSimulator = {
      pair: `${n1 || 'Producto A'} + ${n2 || 'Producto B'}`,
      basePrice,
      comboPrice,
      discountPct: 8,
      estimatedCombos,
      projectedRevenue,
      note: 'Estimacion simple basada en frecuencia historica y 15% de adopcion.',
    };
  }

  return {
    opportunities: opportunities.slice(0, 3),
    risks: risks.slice(0, 3),
    comboSimulator,
  };
}

/**
 * Genera un resumen de insights de IA
 */
export function generateAIInsights(products, orders, days = 30) {
  const lowConversion = detectLowConversionProducts(products, orders, days);
  const combos = suggestCombos(orders, products, 3, days);
  const seasonality = analyzeSeasonality(orders, days);
  const menuSuggestions = suggestMenuImprovements(products, orders, days);
  const diagnostics = buildAIDiagnostics(products, orders, days);
  const strategic = buildStrategicInsights(products, orders, days, {
    combos,
    seasonality,
    diagnostics,
    menuSuggestions,
  });

  return {
    lowConversion,
    combos,
    seasonality,
    menuSuggestions,
    diagnostics,
    strategic,
    summary: {
      totalInsights: lowConversion.length + combos.length + (seasonality?.insights?.length || 0) + menuSuggestions.suggestions.length,
      priority: lowConversion.length > 0 || menuSuggestions.popularWithoutImage.length > 0 ? 'high' : 'medium'
    }
  };
}

