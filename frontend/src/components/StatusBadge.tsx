import type { InvoiceStatus } from '../types';

const CONFIG: Record<InvoiceStatus, { label: string; classes: string }> = {
  pending:      { label: 'Oczekuje',        classes: 'bg-stone-100 text-stone-500' },
  processing:   { label: 'Przetwarzanie',   classes: 'bg-blue-50 text-blue-600 animate-pulse' },
  done:         { label: 'Gotowe',          classes: 'bg-emerald-50 text-emerald-700' },
  needs_review: { label: 'Do weryfikacji',  classes: 'bg-amber-50 text-amber-700' },
  rejected:     { label: 'Odrzucona',       classes: 'bg-red-50 text-red-600' },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.pending;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
