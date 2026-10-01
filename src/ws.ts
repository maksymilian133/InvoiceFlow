import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

const clients = new Map<string, Set<WebSocket>>();

export function initWss(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws-app' });

  wss.on('connection', (ws, req) => {
    const url       = new URL(req.url ?? '', 'http://localhost');
    const invoiceId = url.searchParams.get('id') ?? '__global__';

    if (!clients.has(invoiceId)) clients.set(invoiceId, new Set());
    clients.get(invoiceId)!.add(ws);

    ws.send(JSON.stringify({ type: 'connected', invoiceId }));

    ws.on('close', () => {
      clients.get(invoiceId)?.delete(ws);
      if (clients.get(invoiceId)?.size === 0) clients.delete(invoiceId);
    });

    ws.on('error', (err) => console.error('ws error:', err.message));
  });
}

export function broadcast(invoiceId: string, type: string, data: unknown): void {
  const payload = JSON.stringify({ type, invoiceId, ...(data as object) });

  clients.get(invoiceId)?.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });

  clients.get('__global__')?.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}
