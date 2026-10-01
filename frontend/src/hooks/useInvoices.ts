import { useState, useEffect, useCallback } from 'react';
import { fetchInvoices, fetchInvoice } from '../api';
import type { Invoice } from '../types';

const WS_HOST = import.meta.env.DEV ? 'localhost:3000' : window.location.host;

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${WS_HOST}/ws-app?id=__global__`);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          type: string;
          invoiceId: string;
          status?: string;
        };
        if (msg.type === 'status_update' && msg.status) {
          const finalStatus = msg.status as Invoice['status'];
          if (finalStatus === 'done' || finalStatus === 'needs_review') {
            fetchInvoice(msg.invoiceId)
              .then((full) => {
                setInvoices((prev) =>
                  prev.map((inv) => inv.id === full.id ? full : inv),
                );
              })
              .catch(() => null);
          } else {
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === msg.invoiceId
                  ? { ...inv, status: finalStatus }
                  : inv,
              ),
            );
          }
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => ws.close();
    return () => ws.close();
  }, []);

  const removeLocally = (id: string) =>
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));

  const prependInvoice = (inv: Invoice) =>
    setInvoices((prev) => [inv, ...prev]);

  return { invoices, loading, error, refresh: load, removeLocally, prependInvoice };
}
