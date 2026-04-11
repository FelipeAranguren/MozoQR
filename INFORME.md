# INFORME — Seguridad MozoQR (basado en tu .zip real)
Fecha: 2025-10-08

> **Repositorio leído:** `/backend` y `/frontend` dentro del zip `proyecto_codigo_2025-10-08.zip` (extraído en `/mnt/data/proyecto`).  
> Todas las rutas, archivos y decisiones citadas corresponden a este código real.

---

## 1) Estado actual (backend Strapi v4)

### Middlewares presentes
- `backend/src/middlewares/secure-headers.js` ⇒ agrega `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, y `Content-Security-Policy: frame-ancestors 'none'`; activa `HSTS` si `PUBLIC_URL` es HTTPS.
- `backend/src/middlewares/rate-limit.js` ⇒ rate-limit en memoria por IP+ruta (60 req/60s).
- `backend/src/middlewares/idempotency-orders.js` ⇒ idempotencia para `POST /restaurants/:slug/orders` (ventana ~90s) y eco de `Idempotency-Key`.
- `backend/src/middlewares/audit-log.js` ⇒ loguea método, ruta, status, slug y `tableSessionId` (sin PII).

**Wiring**: `backend/config/middlewares.js` ya define CORS (incluye `Idempotency-Key` en headers), Helmet (CSP) y core de Strapi. Para asegurar activación consistente, agrego el wiring explícito de los 4 middlewares custom (ver parche).

### Policies
- `backend/src/policies/by-restaurant.js` ⇒ **multi-tenant estricto**: valida `:slug`, busca el restaurante publicado y adjunta `ctx.state.restauranteId` + `ctx.state.restaurantePlan`.

### Rutas relevantes (namespace público con slug)
- `backend/src/api/restaurante/routes/menus.js` ⇒ `GET /restaurants/:slug/menus` (auth: false, policy `global::by-restaurant`).
- `backend/src/api/pedido/routes/scoped-orders.js` ⇒
  - `POST /restaurants/:slug/orders` (auth: false, policy `global::by-restaurant`).
  - Rutas para staff/owner (auth: true) con la misma policy para scope.
- `backend/src/api/payments/routes/payments.js` ⇒ `POST /restaurants/:slug/payments` (auth: false, policy `global::by-restaurant`).

### Controladores clave
- `backend/src/api/restaurante/controllers/menus.js` ⇒ **plan gating** de imágenes: oculta imagen salvo plan `PRO` (usa `ctx.state.restaurantePlan`).
- `backend/src/api/pedido/controllers/scoped-orders.js` ⇒ **validación y subtotal en servidor** al crear pedido:
  - Verifica `table`, valida `items`, busca mesa y **(si no existe)** crea sesión.
  - Para cada ítem: verifica existencia y disponibilidad del producto y suma **subtotal con precios actuales**.
  - Evita duplicados recientes para la misma sesión y total.
  - Crea `pedido` + `item-pedido` y devuelve la orden completa.
  - **Mejora aplicada** (parche): sanitización anti‑XSS de `notes` y `customerNotes` sin cambiar nombres ni lógica.
- `backend/src/api/payments/controllers/payments.js` ⇒ **recalcula subtotal en servidor** desde `item-pedido` (o cae a `order.total` si el CT difiere), compara con `amount` (si viene en el payload) y si difiere devuelve 400; si `status === 'approved'` marca `order_status='paid'`.

### Core routers
- `src/api/*/routes/*.ts` usan `factories.createCoreRouter(...)` (auth por defecto). Los 3 endpoints públicos están definidos explícitamente con `auth: false` en sus routers dedicados.

---

## 2) Brechas y desvíos detectados

1. **Wiring de middlewares custom**: los archivos existen pero el `config/middlewares.js` contiene fragmentos abreviados; para evitar dependencias de setup manual, se agrega wiring explícito de `global::secure-headers`, `global::audit-log`, `global::rate-limit` e `global::idempotency-orders` (parche 1).
2. **Sanitización de notas**: `scoped-orders.js` tomaba `notes` de items y de la orden sin sanitizar. Se agrega sanitizado mínimo anti‑XSS (parche 2), **sin renombrar campos ni cambiar la estructura**.
3. **Roles & permisos (Admin)**: por código ya quedan públicos solo `/menus`, `POST /orders` y `POST /payments`. Aun así, en Strapi el rol *public* puede tener permisos marcados manualmente. **QA** incluye pasos para verificar que no haya otros endpoints expuestos al público y desmarcar cualquier permiso inadvertido.
4. **Rate‑limit**: existe y ahora queda cableado globalmente. QA cubre retorno **429** al superar umbral.
5. **HSTS**: se activa **solo** si `PUBLIC_URL` inicia con `https://`, cumpliendo la restricción pedida.
6. **JWT**: no se evidencia configuración custom de expiración/refresh en el repo. Lo documento como **recomendación** (sin refactor ni renombres).

---

## 3) Correcciones mínimas aplicadas (parches)

- **Parche 1:** `backend/config/middlewares.js` — agrega wiring explícito de:
  - `global::secure-headers`
  - `global::audit-log`
  - `global::rate-limit`
  - `global::idempotency-orders`
  - *Justificación:* asegurar que seguridad, rate-limit, idempotencia y logging queden activos sin cambios de nombres ni refactors.

- **Parche 2:** `backend/src/api/pedido/controllers/scoped-orders.js` — sanitiza `notes` (por ítem y de la orden) con `sanitizeText()`:
  - *Justificación:* evitar XSS en `notes/customerNotes` sin tocar nombres/contratos.

> Ambos parches son **mínimos**, no introducen campos nuevos, ni renombrados, ni cambios de rutas.

---

## 4) QA (resumen)
Ver `QA.md` con los **pasos y cURL listos** para:
- Multi‑tenant: `:slug` faltante o inválido.
- Roles público: solo 3 endpoints disponibles.
- Orders: validaciones (`qty<=0`, prod no disponible o inexistente), subtotal **siempre** de servidor, idempotencia (reintentos dentro de 90s).
- Payments: `amount` inconsistente vs servidor ⇒ **400**.
- Menús: plan ≠ PRO ⇒ imagen oculta.
- CORS/Headers/HSTS y Rate‑limit (429).

---

## 5) Recomendaciones (sin tocar código existente)
- **JWT**: establecer expiración corta (p.ej. 15m) y habilitar refresh tokens manteniendo *claims* actuales (config en `config/plugins.js` de users-permissions).
- **Persistencia idempotencia**: si se desea ventana mayor que 90s o alta concurrencia, considerar una tabla liviana (uid `api::idempotency.key`) o almacén externo; *no se implementa aquí* para respetar cambios mínimos.
- **Observabilidad**: enviar `audit-log` a un sink (e.g. Datadog/ELK) en producción (sin PII).

