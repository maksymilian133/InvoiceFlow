import { useEffect, useState } from 'react';
import { fetchInvoice, approveInvoice, rejectInvoice, patchInvoice } from '../api';
import StatusBadge from './StatusBadge';
import type { Invoice, ExtractedData } from '../types';

interface Props {
  invoiceId: string;
  onClose:   () => void;
}

const WS_HOST = import.meta.env.DEV ? 'localhost:3000' : window.location.host;

export default function InvoiceDetail({ invoiceId, onClose }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchInvoice(invoiceId)
      .then(setInvoice)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${WS_HOST}/ws-app?id=${invoiceId}`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string };
        if (msg.type === 'status_update' || msg.type === 'connected') {
          fetchInvoice(invoiceId).then(setInvoice).catch(() => null);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => ws.close();
    return () => ws.close();
  }, [invoiceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (loading) return (
    <Drawer onClose={onClose}>
      <div className="flex justify-center items-center flex-1">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </div>
    </Drawer>
  );

  if (error || !invoice) return (
    <Drawer onClose={onClose}>
      <p className="text-sm text-red-600">{error ?? 'Brak danych'}</p>
    </Drawer>
  );

  const ex = invoice.extracted;

  return (
    <Drawer onClose={onClose}>
      {/* Header */}
      <div className="border-b border-stone-100 pb-4 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-stone-400 truncate mb-0.5">
              {invoice.filename ?? 'wklejony tekst'}
            </p>
            <h2 className="text-base font-semibold text-stone-900 truncate">
              {ex?.numer_faktury ?? 'Faktura bez numeru'}
            </h2>
            {ex?.data_wystawienia && (
              <p className="text-xs text-stone-400 mt-0.5">Wystawiono {ex.data_wystawienia}</p>
            )}
          </div>
          <div className="shrink-0 pt-0.5">
            <StatusBadge status={invoice.status} />
          </div>
        </div>
      </div>

      {/* Review panel */}
      {invoice.status === 'needs_review' && ex && (
        <ReviewPanel
          invoice={invoice}
          onUpdated={setInvoice}
        />
      )}

      {/* Rejection note */}
      {invoice.status === 'rejected' && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
          Faktura odrzucona.
        </div>
      )}

      {/* Error */}
      {invoice.error_msg && invoice.status !== 'needs_review' && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
          {invoice.error_msg}
        </div>
      )}

      {/* ERP ref */}
      {invoice.erp_ref && (
        <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-700 flex items-center justify-between">
          <span>Zaksięgowano w ERP</span>
          <span className="font-mono font-medium">{invoice.erp_ref}</span>
        </div>
      )}

      {ex && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <PartyCard label="Sprzedawca" party={ex.seller} />
            <PartyCard label="Nabywca"    party={ex.buyer}  />
          </div>

          <div className="mb-5 flex items-center justify-between rounded-md bg-stone-50 border border-stone-200 px-4 py-3">
            <span className="text-xs text-stone-500">Do zapłaty</span>
            <span className="text-lg font-semibold text-stone-900 font-mono tabular-nums">
              {ex.kwota_brutto.toFixed(2)}&nbsp;{ex.waluta}
            </span>
          </div>

          {ex.pozycje?.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
                Pozycje ({ex.pozycje.length})
              </p>
              <div className="overflow-x-auto rounded-md border border-stone-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-stone-50 text-stone-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nazwa</th>
                      <th className="px-3 py-2 text-right font-medium">Ilość</th>
                      <th className="px-3 py-2 text-right font-medium">Cena netto</th>
                      <th className="px-3 py-2 text-right font-medium">VAT</th>
                      <th className="px-3 py-2 text-right font-medium">Brutto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ex.pozycje.map((p, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-3 py-2 text-stone-700">{p.nazwa}</td>
                        <td className="px-3 py-2 text-right text-stone-600 tabular-nums">{p.ilosc}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-600 tabular-nums">{p.cena_netto.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-stone-500">{p.vat_rate}%</td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-stone-800 tabular-nums">{p.brutto.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ex._validation_notes && ex._validation_notes.length > 0 && (
            <details className="mb-4">
              <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600 select-none">
                Wyniki walidacji ({ex._validation_notes.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {ex._validation_notes.map((note, i) => (
                  <li key={i} className={`text-xs px-2.5 py-1 rounded ${
                    note.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {note}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ex._model && (
            <p className="text-xs text-stone-300 mt-1">
              {ex._model}{ex._processing_ms != null && ` · ${(ex._processing_ms / 1000).toFixed(1)}s`}
            </p>
          )}
        </>
      )}

      <details className="mt-6">
        <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600 select-none">
          Surowy tekst faktury
        </summary>
        <pre className="mt-2 text-xs bg-stone-50 border border-stone-100 rounded-md p-3 overflow-auto max-h-52 text-stone-500 whitespace-pre-wrap leading-relaxed">
          {invoice.raw_text}
        </pre>
      </details>
    </Drawer>
  );
}

// ── Review Panel ──────────────────────────────────────────────────────

interface ReviewPanelProps {
  invoice:   Invoice;
  onUpdated: (inv: Invoice) => void;
}

function ReviewPanel({ invoice, onUpdated }: ReviewPanelProps) {
  const ex = invoice.extracted!;

  const [kwota,      setKwota]      = useState(ex.kwota_brutto.toFixed(2));
  const [waluta,     setWaluta]     = useState(ex.waluta ?? 'PLN');
  const [sellerNip,  setSellerNip]  = useState(ex.seller?.nip ?? '');
  const [buyerNip,   setBuyerNip]   = useState(ex.buyer?.nip ?? '');
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState<string | null>(null);

  const isDirty =
    kwota     !== ex.kwota_brutto.toFixed(2) ||
    waluta    !== (ex.waluta ?? 'PLN') ||
    sellerNip !== (ex.seller?.nip ?? '') ||
    buyerNip  !== (ex.buyer?.nip ?? '');

  const saveAndApprove = async () => {
    setBusy(true);
    setErr(null);
    try {
      let current = invoice;

      if (isDirty) {
        const updatedEx: ExtractedData = {
          ...ex,
          kwota_brutto: parseFloat(kwota),
          waluta,
          seller: { ...ex.seller, nip: sellerNip.replace(/[-\s]/g, '') },
          buyer:  { ...ex.buyer,  nip: buyerNip.replace(/[-\s]/g, '') },
        };
        current = await patchInvoice(invoice.id, { extracted: updatedEx });
      }

      const approved = await approveInvoice(current.id);
      onUpdated(approved);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Oznaczyć fakturę jako odrzuconą?')) return;
    setBusy(true);
    setErr(null);
    try {
      const rejected = await rejectInvoice(invoice.id);
      onUpdated(rejected);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-800 mb-3 uppercase tracking-wide">
        Weryfikacja wymagana
      </p>

      {invoice.error_msg && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5 mb-3">
          {invoice.error_msg}
        </p>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-amber-700 mb-1">Kwota brutto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={kwota}
              onChange={(e) => setKwota(e.target.value)}
              className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono text-stone-800"
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-amber-700 mb-1">Waluta</label>
            <select
              value={waluta}
              onChange={(e) => setWaluta(e.target.value)}
              className="w-full rounded border border-amber-200 bg-white px-2 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-amber-400 text-stone-800 cursor-pointer"
            >
              {['PLN', 'EUR', 'USD', 'GBP'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-amber-700 mb-1">NIP sprzedawcy</label>
            <input
              type="text"
              value={sellerNip}
              onChange={(e) => setSellerNip(e.target.value)}
              placeholder="10 cyfr"
              className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono text-stone-800"
            />
          </div>
          <div>
            <label className="block text-xs text-amber-700 mb-1">NIP nabywcy</label>
            <input
              type="text"
              value={buyerNip}
              onChange={(e) => setBuyerNip(e.target.value)}
              placeholder="10 cyfr"
              className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono text-stone-800"
            />
          </div>
        </div>
      </div>

      {err && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5 mb-3">
          {err}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => void saveAndApprove()}
          disabled={busy}
          className="flex-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-700 disabled:opacity-40
            text-white text-xs font-medium rounded transition-colors"
        >
          {busy ? 'Przetwarzanie…' : isDirty ? 'Zapisz i zatwierdź' : 'Zatwierdź i wyślij do ERP'}
        </button>
        <button
          onClick={() => void handleReject()}
          disabled={busy}
          className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50
            disabled:opacity-40 text-xs font-medium rounded transition-colors"
        >
          Odrzuć
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">Szczegóły</span>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors"
            aria-label="Zamknij"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

function PartyCard({ label, party }: { label: string; party: { nazwa: string; nip: string } }) {
  return (
    <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2.5">
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-stone-800 leading-snug">{party.nazwa}</p>
      <p className="text-xs text-stone-400 mt-0.5">NIP: {party.nip}</p>
    </div>
  );
}
