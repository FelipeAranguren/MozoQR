# Propuesta de Mejoras para el Historial de Pedidos/Cuentas

## 📊 Situación Actual

El historial actual muestra:
- **Tab de Pedidos**: Lista de todos los pedidos en formato de cards
- **Tab de Cuentas**: Lista de cuentas agrupadas por mesa/sesión

**Problemas identificados:**
- ❌ No hay filtros (fecha, estado, mesa)
- ❌ No hay búsqueda
- ❌ Información limitada (falta tiempo transcurrido, estado visible, método de pago)
- ❌ Solo vista de cards (difícil analizar muchos pedidos)
- ❌ No hay estadísticas rápidas
- ❌ No se puede exportar

## ✅ Mejoras Propuestas

### 1. **Filtros Útiles** (Prioridad Alta)
- **Filtro por fecha**: Hoy, Ayer, Esta semana, Este mes, Rango personalizado
- **Filtro por estado**: Todos, Pendiente, En preparación, Completado, Cancelado, Pagado
- **Filtro por mesa**: Dropdown con todas las mesas
- **Filtro por método de pago**: Efectivo, Tarjeta, MercadoPago, Sin pago (invitado)

### 2. **Búsqueda** (Prioridad Alta)
- Buscar por ID de pedido
- Buscar por nombre de producto/item
- Buscar por notas del cliente

### 3. **Información Más Relevante** (Prioridad Media)
- **Tiempo transcurrido**: "Hace 15 min", "Hace 2 horas"
- **Estado visible**: Badge con color (Pendiente=amarillo, Completado=verde, etc.)
- **Método de pago**: Icono + texto (si está pagado)
- **Duración del servicio**: Tiempo desde creación hasta pago
- **Cantidad de items**: Número total de productos en el pedido

### 4. **Vista de Tabla** (Prioridad Media)
- Alternar entre vista de Cards y Tabla
- Tabla con columnas: ID, Mesa, Fecha/Hora, Items, Total, Estado, Acciones
- Ordenamiento por columnas
- Paginación (20-50 items por página)

### 5. **Estadísticas Rápidas** (Prioridad Baja)
- **Resumen del día**: Total de pedidos, Total facturado, Promedio por mesa
- **Por estado**: Cantidad de pedidos en cada estado
- **Top productos**: Los 5 productos más pedidos
- **Horas pico**: Gráfico de pedidos por hora

### 6. **Exportación** (Prioridad Baja)
- Exportar a CSV
- Imprimir reporte

## 🎯 Implementación Sugerida

### Fase 1 (Esencial - Hacer primero):
1. ✅ Filtros básicos (fecha, estado, mesa)
2. ✅ Búsqueda simple
3. ✅ Mejorar información en cards (tiempo transcurrido, estado visible)

### Fase 2 (Mejoras):
4. ✅ Vista de tabla
5. ✅ Estadísticas rápidas básicas

### Fase 3 (Nice to have):
6. ✅ Exportación
7. ✅ Estadísticas avanzadas

## 💡 Ejemplos de lo que el Staff Necesita Ver

**Caso 1: "¿Cuánto facturamos hoy?"**
- Necesita: Filtro "Hoy" + Total visible

**Caso 2: "Un cliente dice que pidió algo y no le llegó"**
- Necesita: Buscar por mesa/hora + Ver detalles del pedido

**Caso 3: "¿Qué pedidos están tardando mucho?"**
- Necesita: Ordenar por tiempo transcurrido + Ver estado

**Caso 4: "Necesito el reporte del mes para contabilidad"**
- Necesita: Filtro por mes + Exportar

## 📝 Notas de Diseño

- Mantener la vista de cards para uso móvil/tablet
- Agregar vista de tabla para desktop/analisis
- Los filtros deben ser rápidos de aplicar (no recargar toda la página)
- Las estadísticas deben ser visibles sin hacer scroll
