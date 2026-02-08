# Análisis Profesional: Dashboard de Staff

## 🔍 Problemas Identificados

### 1. **Estadísticas del Historial**
**Problema**: Ocupan espacio valioso dentro del drawer, especialmente si están en cero.
**Análisis**: Las estadísticas son útiles, pero deberían estar:
- Fuera del drawer (en el dashboard principal)
- O ser más compactas y condicionales (solo mostrar si hay datos)

**Solución**: Mover al dashboard principal como resumen rápido del día.

### 2. **Estado "Espera pago"**
**Problema**: Muestra "Espera pago" cuando hay pedidos servidos, pero debería ser solo "Ocupado" hasta que haya solicitud real de pago.
**Código actual**: `hasServed && !hasPaid ? 'Espera pago' : 'Ocupada'`
**Lógica correcta**: 
- "Ocupado" = Hay pedidos activos (pending, preparing, served) sin solicitud de pago
- "Solicita pago" = Hay system call de tipo "SOLICITUD DE COBRO"
- "Espera pago" = Solo después de que el cliente solicite pago explícitamente

**Solución**: Cambiar lógica para que "Espera pago" solo aparezca cuando hay solicitud explícita.

### 3. **Falta detalle de items en pedidos activos**
**Problema**: En el dialog de mesa, solo muestra "X items" pero no qué items son.
**Análisis**: El staff necesita ver QUÉ se pidió, no solo cuántos items.
**Solución**: Mostrar lista de items (similar a como se muestra en el historial).

### 4. **Pedidos ya servidos no se muestran**
**Problema**: En el dialog de mesa solo se muestran pedidos activos (pending, preparing, served), pero no hay historial de pedidos ya completados de esa sesión.
**Análisis**: El staff necesita ver el historial completo de la mesa para entender el contexto.
**Solución**: Agregar sección "Historial de pedidos" con pedidos servidos/completados.

### 5. **Estructura del Dashboard**
**Análisis profesional**:
- ✅ Separación clara: Activo vs Historial
- ✅ Grid de mesas visual y útil
- ⚠️ Cards de pedidos ocupan mucho espacio
- ⚠️ Falta información contextual (tiempo, items)
- ⚠️ No hay resumen rápido del día

## 📊 Comparación con Sistemas Profesionales

### **Toast POS / Lightspeed / Square**
- **Dashboard principal**: Resumen del día + pedidos activos en tabla compacta
- **Estado de mesas**: Visual claro, solo estados esenciales
- **Detalle de mesa**: Historial completo + pedidos activos + cuenta
- **Información mostrada**: Items detallados, tiempo transcurrido, notas

### **Lo que hacen bien**:
1. Tabla compacta para pedidos activos (no cards)
2. Estados simples: Ocupado, Disponible, Por limpiar
3. Detalle completo al clickear (historial + activo)
4. Resumen del día siempre visible

## 🎯 Propuestas de Mejora

### **Prioridad Alta**

1. **Mover estadísticas fuera del historial**
   - Colocar en dashboard principal
   - Más visibles y útiles
   - No ocupan espacio en drawer

2. **Corregir lógica de "Espera pago"**
   - Solo mostrar cuando hay solicitud explícita
   - Mientras tanto: "Ocupado"

3. **Mostrar items en pedidos activos**
   - En cards del dashboard
   - En dialog de mesa
   - Formato compacto pero completo

4. **Agregar historial en dialog de mesa**
   - Sección "Pedidos completados"
   - Mostrar todos los pedidos de la sesión actual

### **Prioridad Media**

5. **Vista de tabla para pedidos activos**
   - Alternativa a cards
   - Más eficiente para muchos pedidos

6. **Tiempo transcurrido**
   - "Hace 5 min" en pedidos
   - Indicador de urgencia

### **Prioridad Baja**

7. **Resumen del día en dashboard**
   - Estadísticas siempre visibles
   - No solo en historial

## 💡 Estructura Propuesta

### **Dashboard Principal**
```
┌─────────────────────────────────────┐
│ Resumen del Día (estadísticas)     │
├─────────────────────────────────────┤
│ Pedidos Pendientes (tabla/cards)   │
│ Pedidos en Cocina (tabla/cards)    │
├─────────────────────────────────────┤
│ Grid de Mesas                       │
└─────────────────────────────────────┘
```

### **Dialog de Mesa**
```
┌─────────────────────────────────────┐
│ Mesa X                              │
├─────────────────────────────────────┤
│ Pedidos Activos                     │
│   - Con items detallados            │
├─────────────────────────────────────┤
│ Historial de Pedidos (esta sesión)  │
│   - Pedidos ya servidos/completados │
├─────────────────────────────────────┤
│ Cuenta                              │
│ Acciones                            │
└─────────────────────────────────────┘
```

### **Historial (Drawer)**
```
┌─────────────────────────────────────┐
│ Transacciones (sin estadísticas)    │
│ Filtros                             │
│ Tabla/Cards                         │
└─────────────────────────────────────┘
```
