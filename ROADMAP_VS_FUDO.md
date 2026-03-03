# MozoQR vs Fudo – Comparación y roadmap de mejoras

Referencia: [Fudo Funcionalidades](https://fu.do/es-ar/funcionalidades/)

*(Delivery excluido por decisión del proyecto)*

---

## Estado actual MozoQR vs Fudo

| Funcionalidad Fudo | MozoQR | Prioridad sugerida |
|--------------------|--------|--------------------|
| **Carta QR** (menú digital por QR) | ✅ Ya existe | - |
| **Ventas por mostrador** | ✅ Mostrador + Take Away | - |
| **Asignación de clientes a ventas** | ❌ No existe | Media |
| **Tienda Online** (link para compartir) | ⚠️ Parcial (menú público) | Alta |
| **Confirmación por WhatsApp** | ❌ No existe | Alta |
| **Arqueo de caja** | ❌ No existe | Media |
| **Descuentos fijos y porcentuales** | ✅ Sí (mostrador + cupones cliente) | - |
| **Cierre parcial de ventas** | ❌ No existe | Media |
| **Múltiples medios de pago** | ✅ Tarjeta, MP, efectivo | - |
| **Integración Mercado Pago** | ✅ Sí | - |
| **Control de propinas** | ✅ Cliente puede dar; staff ve total | ⚠️ Reporte propinas |
| **Categorías de productos** | ✅ Sí | - |
| **Subcategorías** | ❌ No | Baja |
| **Productos favoritos** | ❌ No | Baja |
| **Modificadores/adicionales** | ❌ No (ej: "sin cebolla") | Alta |
| **Control de stock** | ❌ No | Media |
| **Productos sin disponibilidad** | ⚠️ Campo `available` existe | Baja |
| **Impresión comandas** | ⚠️ Imprimir desde browser | Media |
| **Tickets precuenta** | ✅ Recibo/ticket | - |
| **Múltiples usuarios / roles** | ✅ Owner + Staff | - |
| **Asignación de mesas a mozos** | ❌ No | Media |
| **Traslado de consumos entre mesas** | ❌ No | Media |
| **Mapa de salas/mesas** | ❌ Mesas planas | Media |
| **Monitor de cocina (KDS)** | ⚠️ Mostrador como KDS básico | Media |
| **Tiempos de preparación** | ❌ No | Baja |
| **Alertas sonoras** | ✅ Beep en nuevo pedido | - |
| **Aviso a mozo orden lista** | ❌ No | Media |
| **Exportar a Excel** | ✅ CSV | - |
| **Reportes de ventas** | ✅ Dashboard KPIs | - |
| **Reportes de productos** | ✅ Top productos | - |

---

## Mejoras sugeridas (ordenadas por impacto/esfuerzo)

### 🟢 Rápidas y de alto impacto

1. **Tienda Online compartible**
   - URL pública tipo `tudominio.com/m/mcdonalds` o `/menu/mcdonalds` para compartir por WhatsApp/redes.
   - Ya tenés el menú; falta una página “landing” limpia con QR y link.

2. **Notificación por WhatsApp del estado del pedido**
   - Al cambiar estado (listo, enviado), enviar mensaje al cliente si dejó número.
   - Requiere: Twilio, WhatsApp Business API o similar.

3. **Modificadores/adicionales en productos**
   - Opciones tipo “Sin cebolla”, “Extra queso” con precio opcional.
   - Necesita modelo de datos (modificadores) y UI en `ProductForm` + flujo en cliente.

### 🟡 Mediano plazo

4. **Asignación de mesas a mozos**
   - En el mostrador, asignar mesa(s) a un mozo.
   - Filtrar vista por mozo.
   - Relación mesa–mozo en backend.

5. **Traslado de consumos entre mesas**
   - Mover ítems de una mesa a otra sin perder historial.
   - Botón “Mover a mesa X” en detalle de cuenta.

6. **Cierre parcial de ventas**
   - Marcar solo algunos ítems como cobrados, mantener la cuenta abierta.
   - Nuevo estado intermedio (ej. `partially_paid`) o campo por ítem.

7. **Mapa de mesas / salas**
   - Agrupar mesas en salas (terraza, interior, etc.).
   - Vista de mesas por sala en el mostrador.

8. **Arqueo de caja**
   - Cierre de turno: total ventas, efectivo, tarjeta, propinas.
   - Histórico de arqueos por fecha/turno.

9. **Control de stock básico**
   - Campo `stock` en productos.
   - Reducir stock al confirmar pedido.
   - Bloquear venta si `stock <= 0` y `available = false`.

### 🔵 Mejoras de pulido

10. **Reporte de propinas**
    - Gráfico o lista de propinas por período.
    - Ya tenés el dato; falta la vista en Dashboard.

11. **Productos favoritos**
    - Marcar productos como favoritos para mostrarlos primero en el menú.

12. **Tiempos de preparación**
    - Tiempo estimado por producto o categoría.
    - Mostrar “Listo en ~X min” al cliente.

13. **Aviso al mozo cuando la orden está lista**
    - Badge/notificación en el mostrador para pedidos en estado `ready`.

14. **Asignación de cliente a venta**
    - Campo “Nombre del cliente” en la cuenta o pedido.
    - Útil para buscar y para futuros reportes.

---

## Resumen ejecutivo

**Lo que ya está muy bien en MozoQR:**
- Carta QR + pedidos por mesa
- Mostrador tipo KDS
- Pagos (MP, tarjeta, efectivo)
- Descuentos y cupones
- Propina
- Dashboard con KPIs
- Export CSV
- Roles owner/staff

**Prioridades recomendadas (sin delivery):**
1. Modificadores en productos (impacto alto, complejidad media).
2. Tienda Online compartible (bajo esfuerzo, alto valor).
3. Notificación por WhatsApp (medio esfuerzo, alto valor).
4. Traslado entre mesas (medio esfuerzo, muy útil en restaurantes).
5. Asignación de mesas a mozos.
6. Arqueo de caja.

¿Querés que empecemos por alguna de estas funcionalidades?
