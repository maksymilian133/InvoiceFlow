import type { Invoice, InvoiceStatus } from './types';

const BASE = '/api/invoices';

export async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { data: Invoice[] };
  return json.data;
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Invoice>;
}

export async function uploadInvoiceFile(file: File): Promise<Invoice> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(BASE, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Błąd serwera' })) as { error: string; duplicateId?: string };
    const err = Object.assign(new Error(body.error), { duplicateId: body.duplicateId });
    throw err;
  }
  return res.json() as Promise<Invoice>;
}

export async function uploadInvoiceText(text: string): Promise<Invoice> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Błąd serwera' })) as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<Invoice>;
}

export async function patchInvoice(
  id: string,
  payload: { status?: InvoiceStatus; extracted?: unknown },
): Promise<Invoice> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Invoice>;
}

export async function approveInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Błąd serwera' })) as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<Invoice>;
}

export async function rejectInvoice(id: string): Promise<Invoice> {
  return patchInvoice(id, { status: 'rejected' });
}

export async function deleteInvoice(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
