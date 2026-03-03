# QA — Seguridad MozoQR

> Variables de entorno útiles:
> - `PUBLIC_URL=https://mi-dominio` (activa HSTS)
> - `CORS_ORIGINS=http://localhost:5173`

## 1) Headers de seguridad y CORS
- Realizar un GET a cualquier endpoint (p.ej. `/restaurants/demo/menus`) y verificar headers:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` que incluya `frame-ancestors 'none'`
  - **Si `PUBLIC_URL` con HTTPS** ⇒ `Strict-Transport-Security` presente.

```bash
curl -i "http://localhost:1337/restaurants/demo/menus"
```

## 2) Rate limiting
- Ejecutar >60 requests en 60s al mismo endpoint y verificar `429 Too Many Requests` y headers `X-RateLimit-*`.

```bash
for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:1337/restaurants/demo/menus"; done
```

## 3) Multi‑tenant por slug
- Sin `:slug` ⇒ Strapi no matchea ruta (404). Con `:slug` inválido ⇒ `404 Restaurante no encontrado`.

```bash
curl -i "http://localhost:1337/restaurants/slug-invalido/menus"
```

## 4) Público: solo 3 endpoints
- Verificar en Admin (Usuarios & Permisos → Roles → Public) que **solo** estén tildados:
  - `GET /restaurants/:slug/menus`
  - `POST /restaurants/:slug/orders`
  - `POST /restaurants/:slug/payments`
- Probar endpoints core (`/api/productos`, `/api/pedidos`, etc.) desde rol público ⇒ deben **requerir auth** (401/403).

```bash
curl -i "http://localhost:1337/api/productos"
```

## 5) Orders — validaciones + subtotal server + idempotencia
- Payload con `qty <= 0` ⇒ `400`:

```bash
curl -i -X POST "http://localhost:1337/restaurants/demo/orders" \
  -H "Content-Type: application/json" \
  --data '{"table":1,"tableSessionId":"S1","items":[{"productId":123,"qty":0}] }'
```

- Producto inexistente o `available=false` ⇒ `400` (mensaje claro).
- Total del cliente es **ignorado**: el servidor calcula `subtotal` con precios actuales. (No enviar `total` en payload).

- **Idempotencia**: repetir el mismo POST en <90s con el mismo `Idempotency-Key` (o mismo body si el middleware lo deriva) ⇒ **no duplica**.
```bash
curl -i -X POST "http://localhost:1337/restaurants/demo/orders"   -H "Content-Type: application/json"   -H "Idempotency-Key: demo-123"   --data '{"table":1,"tableSessionId":"S1","items":[{"productId":123,"qty":2}] }'
# repetir exactamente el mismo comando: se debe devolver la misma orden (o meta.deduped=true)
```

## 6) Payments — monto vs subtotal servidor
- Si `amount` difiere del subtotal server ⇒ `400`.
```bash
curl -i -X POST "http://localhost:1337/restaurants/demo/payments"   -H "Content-Type: application/json"   --data '{"orderId": 1, "status":"approved", "amount": 999999, "provider":"mock"}'
```

- Caso aprobado y consistente ⇒ `200` y el pedido queda `order_status='paid'`.

## 7) Menús — Plan gating de imagen
- Con restaurante en plan diferente de `PRO`, la respuesta de productos **no** debe incluir la imagen.
- Con plan `PRO`, verificar que la URL de imagen se incluya.

## 8) Logging básico
- Revisar logs de Strapi: cada request debe registrar método, path, status, `slug` y `tableSessionId` (cuando aplique), sin PII.
