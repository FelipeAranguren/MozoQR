# Auditoría: Mesas, Recibo y Liberar Mesa

**Fecha:** 8 feb 2026

## Problemas reportados

1. **Entrar a mesa:** Requiere varios intentos
2. **Recibo:** No se muestra para imprimir después del pago
3. **Liberar mesa:** Botón da error 403 Forbidden

---

## Cambios realizados

### 1. Liberar mesa (403)

- **Causa:** El endpoint `force-release-all` requiere auth owner/staff; la policy `by-restaurant-owner` fallaba al filtrar por `restaurante: { slug }` en la relación.
- **Fix backend:** En `by-restaurant-owner.ts` se usa `restaurante: { id: restaurant.id }` en lugar de `restaurante: { slug }`.
- **Fix frontend:** `forceReleaseAllTables` en `tables.js` ahora usa `close-session` en loop en lugar de `force-release-all`.
- **Mensaje 403:** Mensaje más claro cuando falta permiso.

**Reiniciar backend** para aplicar el fix de la policy.

### 2. Recibo no se muestra

- **Causa posible:** `saveReceiptForDownload` no generaba recibo cuando `orderDetails` estaba vacío.
- **Fix:**
  - Fallback a `openOrders` cuando no hay `orderDetails`.
  - Condición en PagoSuccess para mostrar recibo: `mesaNumber` además de `items` y `total`.
  - Botón de recibo más visible (variant contained, verde).

### 3. Entrar a mesa (varios intentos)

- **Causa:** Race condition o mesa ocupada momentáneamente; un solo intento y error 409 llevaba al selector.
- **Fix:** Reintentos automáticos (hasta 3 intentos totales) con 1.5 s de espera entre intentos cuando la mesa da 409 u otro error recuperable.

---

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `backend/src/policies/by-restaurant-owner.ts` | Filtro por `restaurante.id` en vez de `slug` |
| `frontend/src/api/tables.js` | `forceReleaseAllTables` usa `close-session` en loop |
| `frontend/src/components/StickyFooter.jsx` | Recibo con fallback a `openOrders` |
| `frontend/src/pages/RestaurantMenu.jsx` | Reintentos en `openTableSession` |
| `frontend/src/pages/PagoSuccess.jsx` | Condición de recibo y botón más visible |
| `frontend/src/pages/ThankYou.jsx` | Botón de recibo más visible |
| `frontend/src/pages/Mostrador.jsx` | Mensaje 403 más claro en liberar mesa |

---

## Verificación

1. **Liberar mesa:** Reiniciar backend, hacer hard refresh (Cmd+Shift+R), probar "Liberar Mesa" en detalle de mesa.
2. **Recibo:** Pagar (tarjeta o MP) y verificar que aparece el botón "Ver / Imprimir recibo" en ThankYou o PagoSuccess.
3. **Entrar a mesa:** Seleccionar mesa varias veces; si da 409, el sistema reintenta hasta 3 veces antes de volver al selector.
