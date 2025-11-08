// frontend/src/components/SalesChartV2.jsx
// Versión completamente mejorada del gráfico con mejor manejo de fechas y etiquetas claras
import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesByDay } from '../api/analytics';

// Formateo de dinero
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const moneyNoCents = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(n) || 0);

// Formateadores de fecha
const fmtDayMonth = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const fmtDay = new Intl.DateTimeFormat('es-AR', { day: 'numeric' });
const fmtMonthYear = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });

// Utilidades de fecha
function toLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function getDaysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Determina el tipo de visualización según el rango de días
function determineChartType(daysCount, periodKey) {
  // Si es un período predefinido, usar su tipo
  if (periodKey === '1y' || periodKey === '12m') return 'monthly';
  if (periodKey === '6m') return 'monthly'; // 6 meses también por mes
  
  // Para custom o períodos largos, determinar automáticamente
  if (daysCount > 90) return 'monthly'; // Más de 3 meses -> agrupar por mes
  if (daysCount > 45) return 'weekly'; // Más de 1.5 meses -> agrupar por semana
  if (daysCount > 15) return 'daily-sparse'; // Más de 2 semanas -> días con etiquetas espaciadas
  return 'daily'; // Menos de 2 semanas -> todos los días
}

// Agrupa datos por mes con etiquetas claras
function groupByMonth(dailyData, startDate, endDate) {
  const byMonth = new Map();
  
  // Crear todos los meses en el rango
  const months = [];
  const current = new Date(startDate);
  current.setDate(1); // Primer día del mes
  const end = new Date(endDate);
  end.setDate(1);
  
  while (current <= end) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      date: new Date(current),
      total: 0,
    });
    current.setMonth(current.getMonth() + 1);
  }
  
  // Agregar datos
  for (const item of dailyData) {
    const date = toLocalDate(item.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = months.find(m => m.key === key);
    if (month) {
      month.total += Number(item.total) || 0;
    }
  }
  
  return months.map(month => ({
    date: month.date,
    total: month.total,
    label: fmtMonthYear.format(month.date),
    xLabel: fmtMonthYear.format(month.date),
  }));
}

// Agrupa datos por semana con etiquetas claras
function groupByWeek(dailyData, startDate, endDate) {
  const byWeek = new Map();
  
  // Crear todas las semanas en el rango
  const weeks = [];
  const current = new Date(startDate);
  // Ir al lunes de la semana
  const dayOfWeek = current.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  
  while (current <= end) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const key = current.toISOString().slice(0, 10);
    weeks.push({
      key,
      date: new Date(current),
      weekEnd: new Date(weekEnd),
      total: 0,
    });
    current.setDate(current.getDate() + 7);
  }
  
  // Agregar datos
  for (const item of dailyData) {
    const date = toLocalDate(item.date);
    // Encontrar la semana correspondiente
    const week = weeks.find(w => date >= w.date && date <= w.weekEnd);
    if (week) {
      week.total += Number(item.total) || 0;
    }
  }
  
  // Formatear etiquetas más claras: "20-26 Oct" o "20 Oct - 2 Nov" si cruza meses
  return weeks.map(week => {
    const startDate = week.date;
    const endDate = week.weekEnd;
    const sameMonth = startDate.getMonth() === endDate.getMonth() && 
                      startDate.getFullYear() === endDate.getFullYear();
    
    let label = '';
    if (sameMonth) {
      // Mismo mes: "20-26 Oct" (día inicial - día final + mes)
      const monthName = fmtDayMonth.format(startDate).split(' ')[1]; // Extraer solo el mes
      label = `${startDate.getDate()}-${endDate.getDate()} ${monthName}`;
    } else {
      // Cruza meses: "20 Oct - 2 Nov" (día mes - día mes)
      label = `${startDate.getDate()} ${fmtDayMonth.format(startDate).split(' ')[1]} - ${endDate.getDate()} ${fmtDayMonth.format(endDate).split(' ')[1]}`;
    }
    
    return {
      date: week.date,
      total: week.total,
      label,
      xLabel: label,
    };
  });
}

// Procesa datos diarios con etiquetas espaciadas y claras
function processDailySparse(dailyData, startDate, endDate) {
  const maxLabels = 15;
  const step = Math.ceil(dailyData.length / maxLabels);
  
  return dailyData.map((item, index) => {
    const date = toLocalDate(item.date);
    const showLabel = index % step === 0 || index === dailyData.length - 1;
    
    // Determinar si es el primer día del mes para mostrar el mes
    const isFirstOfMonth = date.getDate() === 1;
    const isLastOfMonth = date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    let label = '';
    if (showLabel) {
      if (isFirstOfMonth || index === 0) {
        // Mostrar día y mes: "1 Oct"
        label = fmtDayMonth.format(date);
      } else {
        // Solo día: "5"
        label = String(date.getDate());
      }
    }
    
    return {
      date,
      total: Number(item.total) || 0,
      label,
      xLabel: label,
      showMonthLabel: isFirstOfMonth || index === 0,
    };
  });
}

// Procesa datos diarios normales
function processDaily(dailyData, periodKey) {
  return dailyData.map((item, index) => {
    const date = toLocalDate(item.date);
    let label = '';
    
    if (periodKey === '7d') {
      // 7 días: mostrar día de la semana abreviado: "Lun", "Mar", etc.
      label = fmtWeekday.format(date).replace('.', '');
    } else if (periodKey === '15d') {
      // 15 días: mostrar día y mes cuando cambia el mes
      const isFirstOfMonth = date.getDate() === 1;
      const isFirstDay = index === 0;
      if (isFirstOfMonth || isFirstDay) {
        // Mostrar día y mes: "1 Oct"
        label = fmtDayMonth.format(date);
      } else {
        // Solo día: "5"
        label = String(date.getDate());
      }
    } else {
      // Para 30 días o custom corto: mostrar día y mes cuando cambia el mes
      const isFirstOfMonth = date.getDate() === 1;
      const isFirstDay = index === 0;
      if (isFirstOfMonth || isFirstDay) {
        // Mostrar día y mes: "1 Oct"
        label = fmtDayMonth.format(date);
      } else {
        // Solo día: "5"
        label = String(date.getDate());
      }
    }
    
    return {
      date,
      total: Number(item.total) || 0,
      label,
      xLabel: label,
      showMonthLabel: date.getDate() === 1 || index === 0,
    };
  });
}

// Calcula el máximo "bonito" para el eje Y
function niceCeil(value) {
  if (!isFinite(value) || value <= 0) return 1;
  const headroom = 1.1; // 10% de espacio arriba
  const target = value * headroom;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const normalized = target / magnitude;
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find(s => normalized <= s) || 10;
  return step * magnitude;
}

export default function SalesChartV2({ slug, start, end, periodKey = '30d', onTotalChange }) {
  const [series, setSeries] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const startDate = useMemo(() => (start instanceof Date ? start : new Date(start)), [start]);
  const endDate = useMemo(() => (end instanceof Date ? end : new Date(end)), [end]);

  // Fetch de datos
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchSalesByDay(slug, { start: startDate, end: endDate });
        if (!alive) return;
        setSeries(resp.series || []);
        const total = resp.grandTotal || 0;
        setGrandTotal(total);
        onTotalChange?.(total);
      } catch (err) {
        if (!alive) return;
        setSeries([]);
        setGrandTotal(0);
        onTotalChange?.(0);
        setError('No se pudieron cargar las ventas');
        console.error('Error cargando ventas:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug, startDate, endDate, onTotalChange]);

  // Procesar datos según el tipo de gráfico
  const chartData = useMemo(() => {
    if (!series || series.length === 0) return { type: 'daily', bars: [], yMax: 1, monthLabels: [] };

    const daysCount = getDaysBetween(startDate, endDate);
    const chartType = determineChartType(daysCount, periodKey);

    let bars = [];
    let monthLabels = [];

    switch (chartType) {
      case 'monthly':
        bars = groupByMonth(series, startDate, endDate);
        // Para meses, no necesitamos monthLabels adicionales
        break;
      case 'weekly':
        bars = groupByWeek(series, startDate, endDate);
        // Para semanas, agregar etiquetas de mes cada 4 semanas aprox
        break;
      case 'daily-sparse':
        bars = processDailySparse(series, startDate, endDate);
        // Agregar etiquetas de mes arriba
        monthLabels = generateMonthLabels(bars, startDate, endDate);
        break;
      case 'daily':
      default:
        bars = processDaily(series, periodKey);
        // Agregar etiquetas de mes arriba si cruza meses
        monthLabels = generateMonthLabels(bars, startDate, endDate);
        break;
    }

    const maxValue = bars.reduce((max, bar) => Math.max(max, bar.total), 0);
    const yMax = niceCeil(maxValue);

    return { type: chartType, bars, yMax, monthLabels };
  }, [series, startDate, endDate, periodKey]);

  // Generar etiquetas de mes para mostrar arriba del gráfico
  function generateMonthLabels(bars, start, end) {
    if (bars.length === 0) return [];
    
    const labels = [];
    const seenMonths = new Set();
    
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const monthKey = `${bar.date.getFullYear()}-${bar.date.getMonth()}`;
      
      if (!seenMonths.has(monthKey) && (bar.showMonthLabel || i === 0)) {
        seenMonths.add(monthKey);
        const leftPct = (i / bars.length) * 100;
        const widthPct = (1 / bars.length) * 100;
        labels.push({
          leftPct,
          widthPct,
          label: fmtMonthYear.format(bar.date),
        });
      }
    }
    
    return labels;
  }

  // Constantes de diseño
  const COLORS = {
    text: '#374151',
    textMuted: '#6b7280',
    grid: '#e5e7eb',
    axis: '#d1d5db',
    barGradient: ['#bfdbfe', '#93c5fd'],
    barHover: '#60a5fa',
    panelBg: '#ffffff',
    monthLabel: '#4b5563',
  };

  const LEFT_GUTTER = 70;
  const BAR_AREA_H = 240;
  const SAFE_TOP_PAD = 2;
  const AREA_USABLE = BAR_AREA_H - SAFE_TOP_PAD;

  // Convertir valor a altura
  const valueToHeight = (val) => {
    const ratio = Math.max(0, Math.min(1, (Number(val) || 0) / chartData.yMax));
    return Math.floor(ratio * AREA_USABLE);
  };

  // Generar ticks del eje Y
  const yTicks = useMemo(() => {
    const ticks = [];
    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
      const ratio = i / numTicks;
      ticks.push({
        ratio,
        value: chartData.yMax * ratio,
        isMax: i === numTicks,
      });
    }
    return ticks;
  }, [chartData.yMax]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted }}>
        Cargando ventas...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
        {error}
      </div>
    );
  }

  if (!chartData.bars || chartData.bars.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted }}>
        No hay ventas en el período seleccionado.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto' }}>
      <div style={{ marginBottom: 10, fontWeight: 700, color: COLORS.text, fontSize: 18 }}>
        Total del período: {money(grandTotal)}
      </div>

      <div
        style={{
          position: 'relative',
          height: 380,
          border: '1px solid #eef2f7',
          borderRadius: 14,
          background: COLORS.panelBg,
          padding: 14,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', height: '100%' }}>
          {/* Etiquetas de mes arriba (si aplica) */}
          {chartData.monthLabels && chartData.monthLabels.length > 0 && (
            <div style={{ position: 'relative', height: 24, marginBottom: 8, marginLeft: LEFT_GUTTER }}>
              {chartData.monthLabels.map((ml, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${ml.leftPct}%`,
                    width: `${ml.widthPct}%`,
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.monthLabel,
                    letterSpacing: 0.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ml.label}
                </div>
              ))}
            </div>
          )}

          {/* Grilla y eje Y */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: BAR_AREA_H }}>
            <div style={{ position: 'absolute', left: LEFT_GUTTER, top: 0, bottom: 0, borderLeft: `1px solid ${COLORS.axis}` }} />
            {yTicks.map((tick, i) => {
              const y = (1 - tick.ratio) * BAR_AREA_H;
              const isZero = tick.ratio === 0;
              return (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: LEFT_GUTTER - 10,
                      textAlign: 'right',
                      fontSize: 12,
                      fontWeight: tick.isMax ? 600 : 500,
                      color: tick.isMax ? COLORS.text : COLORS.textMuted,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {moneyNoCents(tick.value)}
                  </div>
                  {!isZero && (
                    <div style={{ marginLeft: LEFT_GUTTER, height: 0, borderTop: `1px dashed ${COLORS.grid}` }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Barras */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'end',
              height: BAR_AREA_H,
              marginTop: 12,
              marginLeft: LEFT_GUTTER,
              paddingRight: 8,
              paddingLeft: 8,
            }}
          >
            {chartData.bars.map((bar, idx) => {
              const total = Number(bar.total) || 0;
              const height = valueToHeight(total);
              const isHovered = hoverIdx === idx;

              return (
                <div key={idx} style={{ flex: 1, minWidth: 4, position: 'relative' }}>
                  {/* Tooltip */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: height + 10,
                        transform: 'translateX(-50%)',
                        background: 'rgba(17,24,39,0.95)',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10,
                      }}
                    >
                      {moneyNoCents(total)}
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: -4,
                          transform: 'translateX(-50%) rotate(45deg)',
                          width: 8,
                          height: 8,
                          background: 'rgba(17,24,39,0.95)',
                        }}
                      />
                    </div>
                  )}

                  {/* Barra */}
                  <div
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{
                      height: height,
                      background: `linear-gradient(180deg, ${COLORS.barGradient[0]}, ${COLORS.barGradient[1]})`,
                      borderRadius: 6,
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                      transition: 'all 150ms ease-out',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Etiquetas del eje X */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'start',
              marginTop: 8,
              marginLeft: LEFT_GUTTER,
              paddingRight: 8,
              paddingLeft: 8,
            }}
          >
            {chartData.bars.map((bar, idx) => {
              const label = bar.xLabel || bar.label || '';
              return (
                <div key={idx} style={{ flex: 1, minWidth: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS.textMuted,
                      textAlign: 'center',
                      lineHeight: '14px',
                      minHeight: 14,
                      userSelect: 'none',
                    }}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}