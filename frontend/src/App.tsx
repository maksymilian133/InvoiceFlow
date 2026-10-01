import { useState } from 'react';
import { useInvoices } from './hooks/useInvoices';
import { deleteInvoice } from './api';
import UploadPage    from './components/UploadPage';
import InvoiceList   from './components/InvoiceList';
import InvoiceDetail from './components/InvoiceDetail';
import type { Invoice } from './types';

type Tab = 'upload' | 'invoices';

export default function App() {
  const { invoices, loading, error, refresh, removeLocally, prependInvoice } = useInvoices();
  const [tab,        setTab]        = useState<Tab>('upload');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleUploaded = (inv: Invoice) => {
    prependInvoice(inv);
    setTab('invoices');
    setSelectedId(inv.id);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice(id);
      removeLocally(id);
      if (selectedId === id) setSelectedId(null);
    } catch {
      alert('Nie udało się usunąć faktury.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <span className="font-semibold text-stone-800 tracking-tight">InvoiceFlow</span>
            {tab === 'invoices' && (
              <button
                onClick={() => void refresh()}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                Odśwież
              </button>
            )}
          </div>

          <nav className="flex gap-1 -mb-px">
            {([
              { key: 'upload',   label: 'Dodaj fakturę' },
              { key: 'invoices', label: `Faktury${!loading ? ` (${invoices.length})` : ''}` },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'upload' ? (
          <UploadPage onUploaded={handleUploaded} />
        ) : (
          <InvoiceList
            invoices={invoices}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={(id) => void handleDelete(id)}
          />
        )}
      </main>

      {selectedId && (
        <InvoiceDetail
          invoiceId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
