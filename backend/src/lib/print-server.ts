import { WebSocketServer, WebSocket } from 'ws';

export interface PrintOrderItem {
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

export interface PrintOrder {
  orderId: number;
  restaurantSlug: string;
  mesaNumber: number | null;
  customerNotes: string | null;
  total: number;
  createdAt: string;
  items: PrintOrderItem[];
}

// slug → set of authenticated WebSocket clients for that restaurant
const clients = new Map<string, Set<WebSocket>>();
let wss: WebSocketServer | null = null;

/**
 * Attach a WebSocket server to Strapi's HTTP server.
 * Desktop printer clients connect to ws://<host>/print-ws and authenticate
 * with { type: "auth", token: "<PRINTER_SECRET>", restaurantSlug: "<slug>" }.
 */
export function initPrintServer(httpServer: any): void {
  if (wss) return;

  const secret = process.env.PRINTER_SECRET || '';
  if (!secret) {
    console.warn(
      '[print-server] ⚠️  PRINTER_SECRET no configurado — cualquier cliente puede conectarse sin token',
    );
  }

  wss = new WebSocketServer({ server: httpServer, path: '/print-ws' });

  wss.on('connection', (ws: WebSocket) => {
    let slug: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Require auth as first message
        if (!slug) {
          if (msg.type !== 'auth') {
            ws.send(JSON.stringify({ type: 'error', message: 'Primero enviar mensaje auth' }));
            return;
          }
          if (secret && msg.token !== secret) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Token inválido' }));
            ws.close(1008, 'Unauthorized');
            return;
          }
          if (!msg.restaurantSlug) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Falta restaurantSlug' }));
            ws.close(1008, 'Missing slug');
            return;
          }
          slug = String(msg.restaurantSlug);
          if (!clients.has(slug)) clients.set(slug, new Set());
          clients.get(slug)!.add(ws);
          ws.send(JSON.stringify({ type: 'auth_ok', restaurantSlug: slug }));
          console.log(
            `[print-server] ✅ Impresora conectada: slug=${slug} (${clients.get(slug)!.size} activa(s))`,
          );
          return;
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (slug && clients.has(slug)) {
        clients.get(slug)!.delete(ws);
        if (clients.get(slug)!.size === 0) clients.delete(slug);
      }
      console.log(`[print-server] Impresora desconectada: slug=${slug}`);
    });

    ws.on('error', (err: Error) => {
      console.error(`[print-server] Error en cliente slug=${slug}:`, err.message);
    });
  });

  console.log('[print-server] ✅ WebSocket de impresión listo en ws://<host>/print-ws');
}

/**
 * Send a new_order event to all authenticated desktop clients for this restaurant.
 * Called from scoped-orders.create after the order is persisted.
 */
export function notifyNewOrder(restaurantSlug: string, order: PrintOrder): void {
  const conns = clients.get(restaurantSlug);
  if (!conns || conns.size === 0) return;

  const payload = JSON.stringify({ type: 'new_order', ...order });
  let sent = 0;
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      sent++;
    }
  }
  if (sent > 0) {
    console.log(
      `[print-server] Pedido #${order.orderId} enviado a ${sent} impresora(s) [slug=${restaurantSlug}]`,
    );
  }
}
