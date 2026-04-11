# MozoQR MVP Patch

This bundle adds **scoped, multi-tenant endpoints**, a global **by-restaurant policy**, **public menus & order creation**, **staff polling**, **mock payments**, and **owner KPIs + CSV export**.

## Backend
- `backend/src/policies/by-restaurant.js`
- `backend/src/api/restaurante/routes/menus.js`
- `backend/src/api/restaurante/controllers/menus.js`
- `backend/src/api/pedido/routes/scoped-orders.js`
- `backend/src/api/pedido/controllers/scoped-orders.js`
- `backend/src/api/payment/routes/payments.js`
- `backend/src/api/payment/controllers/payments.js`
- `backend/src/api/restaurante/routes/kpis.js`
- `backend/src/api/restaurante/controllers/kpis.js`

Restart Strapi after copying. In **Users & Permissions**:
- Public role: allow `GET /restaurants/:slug/menus`, `POST /restaurants/:slug/orders`, `POST /restaurants/:slug/payments`.
- Authenticated (staff/owner): allow the rest.

## Frontend
- `frontend/src/http.js`
- `frontend/src/hooks/usePolling.js`
- `frontend/src/pages/OwnerDashboard.jsx` (wiring example)

Point your frontend to backend with `VITE_API_URL`.

