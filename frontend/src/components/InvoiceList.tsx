import { useState, useMemo } from 'react';
import StatusBadge from './StatusBadge';
import type { Invoice, InvoiceStatus } from '../types';

interface Props {
  invoices:   Invoice[];
  loading:    boolean;
  error:      string | null;
  selectedId: string | null;
  onSelect:   (id: string) => void;
  onDelete:   (id: string) => void;
}

const STATUS_OPTIONS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all',          label: 'Wszystkie' },
  { value: 'pending',      label: 'Oczekuje' },
  { value: 'processing',   label: 'Przetwarzanie' },
  { value: 'done',         label: 'Gotowe' },
  { value: 'needs_review', label: 'Do weryfikacji' },
  { value: 'rejected',     label: 'Odrzucone' },
];

type SortField = 'date' | 'amount';
type SortDir   = 'asc' | 'desc';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function InvoiceList({ invoices, loading, error, selectedId, onSelect, onDelete }: Props) {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<InvoiceStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let list = [...invoices];

    if (status !== 'all') {
      list = list.filter((inv) => inv.status === status);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((inv) =>
        inv.filename?.toLowerCase().includes(q) ||
        inv.extracted?.numer_faktury?.toLowerCase().includes(q) ||
        inv.extracted?.kontrahent?.toLowerCase().includes(q) ||
        inv.extracted?.nip?.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'date') {
        diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        diff = (a.extracted?.kwota_brutto ?? 0) - (b.extracted?.kwota_brutto ?? 0);
      }
      return sortDir === 'asc' ? diff : -diff;
    });

    return list;
  }, [invoices, search, status, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-stone-300 ml-1">↕</span>;
    return <span className="text-stone-700 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po nazwie, numerze, kontrahencie…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-stone-200
              focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white
              placeholder:text-stone-400 text-stone-800"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | 'all')}
          className="px-3 py-2 text-sm rounded-md border border-stone-200 bg-white
            focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-700 cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Result count */}
      <p className="text-xs text-stone-400">
        {filtered.length === invoices.length
          ? `${invoices.length} faktur`
          : `${filtered.length} z ${invoices.length}`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-stone-400">
            {invoices.length === 0 ? 'Brak faktur.' : 'Brak wyników dla podanych filtrów.'}
          </p>
          {invoices.length > 0 && (
            <button
              onClick={() => { setSearch(''); setStatus('all'); }}
              className="mt-2 text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-100 text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide bg-stone-50">
                <th className="px-4 py-2.5 text-left font-medium">Plik</th>
                <th className="px-4 py-2.5 text-left font-medium">Nr faktury</th>
                <th className="px-4 py-2.5 text-left font-medium">Kontrahent</th>
                <th
                  className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-stone-600 select-none"
                  onClick={() => toggleSort('amount')}
                >
                  Kwota <SortIcon field="amount" />
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th
                  className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-stone-600 select-none"
                  onClick={() => toggleSort('date')}
                >
                  Data <SortIcon field="date" />
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map((inv) => {
                const ex         = inv.extracted;
                const isSelected = selectedId === inv.id;
                return (
                  <tr
                    key={inv.id}
                    onClick={() => onSelect(inv.id)}
                    className={`cursor-pointer transition-colors hover:bg-stone-50 ${
                      isSelected ? 'bg-stone-50 ring-1 ring-inset ring-stone-200' : ''
                    }`}
                  >
                    <td className="px-4 py-3 max-w-[140px] truncate text-stone-700">
                      {inv.filename ?? <span className="text-stone-400 italic">tekst</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {ex?.numer_faktury ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-stone-700">
                      {ex?.kontrahent ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-700 tabular-nums">
                      {ex
                        ? `${ex.kwota_brutto.toFixed(2)} ${ex.waluta}`
                        : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-stone-400 whitespace-nowrap text-xs">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(inv.id); }}
                        className="text-stone-300 hover:text-red-400 transition-colors"
                        aria-label="Usuń"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                               01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                               00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
