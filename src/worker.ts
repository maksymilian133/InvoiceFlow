import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import axios from 'axios';
import pool from './db';
import redis from './redis';
import type { InvoiceJobData } from './queue';

const OLLAMA_URL   = process.env.OLLAMA_URL   ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const ERP_URL      = process.env.ERP_URL      ?? 'http://localhost:3001';
const API_URL      = process.env.API_URL      ?? 'http://localhost:3000';
const OWN_NIP      = (process.env.OWN_NIP ?? '').replace(/[-\s]/g, '');

interface LineItem {
  nazwa:      string;
  ilosc:      number;
  cena_netto: number;
  vat_rate:   number;
  brutto:     number;
  netto?:     number;
}

interface Party {
  nazwa: string;
  nip:   string;
}

interface ExtractedData {
  seller:       Party;
  buyer:        Party;
  kontrahent:   string;
  nip:          string;
  kwota_brutto: number;
  waluta:       string;
  numer_faktury:    string;
  data_wystawienia: string;
  pozycje: LineItem[];
  _model?:            string;
  _processing_ms?:    number;
  _validation_ok?:    boolean;
  _validation_notes?: string[];
}

const gr = (x: number): number => Math.round(x * 100);
const zl = (x: number): number => Math.round(x) / 100;

function computeNetto(pozycje: LineItem[]): void {
  for (const p of pozycje) {
    p.netto = zl(gr(p.ilosc) * gr(p.cena_netto) / 100);
  }
}

function validateNip(nip: string): boolean {
  const n = nip.replace(/[-\s]/g, '').replace(/^PL/i, '');
  if (!/^\d{10}$/.test(n)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(n[i]), 0);
  return sum % 11 === Number(n[9]);
}

interface ValidationResult {
  errors: string[];
  notes:  string[];
}

function validate(data: ExtractedData): ValidationResult {
  const errors: string[] = [];
  const notes:  string[] = [];

  const sellerNip = (data.seller?.nip ?? '').replace(/[-\s]/g, '').replace(/^PL/i, '');
  const buyerNip  = (data.buyer?.nip  ?? '').replace(/[-\s]/g, '').replace(/^PL/i, '');

  if (!validateNip(sellerNip)) {
    errors.push(`NIP sprzedawcy nieprawidłowy: "${data.seller?.nip}"`);
  } else {
    notes.push('✓ NIP sprzedawcy poprawny');
  }

  if (!validateNip(buyerNip)) {
    errors.push(`NIP nabywcy nieprawidłowy: "${data.buyer?.nip}"`);
  } else {
    notes.push('✓ NIP nabywcy poprawny');
  }

  if (OWN_NIP) {
    if (sellerNip === OWN_NIP) {
      data.kontrahent = data.buyer.nazwa;
      data.nip        = buyerNip;
    } else {
      data.kontrahent = data.seller.nazwa;
      data.nip        = sellerNip;
    }
  } else {
    data.kontrahent = data.seller.nazwa;
    data.nip        = sellerNip;
  }

  if (typeof data.kwota_brutto !== 'number' || data.kwota_brutto <= 0) {
    errors.push('Brak lub nieprawidłowa kwota brutto');
  }

  if (!Array.isArray(data.pozycje) || data.pozycje.length === 0) {
    errors.push('Brak pozycji na fakturze');
  } else {
    let sumaGr = 0;

    data.pozycje.forEach((p, i) => {
      const nr = i + 1;
      const nettoGr = gr(p.ilosc) * gr(p.cena_netto) / 100;
      p.netto = zl(nettoGr);
      notes.push(`✓ Poz. ${nr}: netto = ${p.ilosc}×${p.cena_netto} = ${p.netto}`);

      const bruttoObliczoneGr = Math.round(nettoGr * (100 + p.vat_rate) / 100);
      const bruttoFakturyGr   = gr(p.brutto);
      const diffGr = Math.abs(bruttoObliczoneGr - bruttoFakturyGr);

      if (diffGr > 1) {
        errors.push(
          `Poz. ${nr}: netto ${p.netto} × (1+${p.vat_rate}%) = ${zl(bruttoObliczoneGr)} ≠ brutto ${p.brutto} (różnica ${diffGr} gr)`,
        );
      } else {
        notes.push(`✓ Poz. ${nr}: netto × (1+VAT) = brutto OK`);
      }

      sumaGr += bruttoFakturyGr;
    });

    const tolerance = data.pozycje.length;
    const sumaDiffGr = Math.abs(sumaGr - gr(data.kwota_brutto));

    if (sumaDiffGr > tolerance) {
      errors.push(
        `Suma brutto pozycji (${zl(sumaGr)}) ≠ kwota na fakturze (${data.kwota_brutto}), różnica ${sumaDiffGr} gr`,
      );
    } else {
      notes.push(`✓ Suma brutto pozycji = kwota faktury OK`);
    }
  }

  return { errors, notes };
}

async function sendToErp(invoiceId: string, data: ExtractedData): Promise<string> {
  const resp = await axios.post(`${ERP_URL}/odata/v1/Invoices`, {
    InvoiceId:     invoiceId,
    Vendor:        data.seller.nazwa,
    VendorTaxId:   data.seller.nip.replace(/[-\s]/g, ''),
    Buyer:         data.buyer.nazwa,
    BuyerTaxId:    data.buyer.nip.replace(/[-\s]/g, ''),
    GrossAmount:   data.kwota_brutto,
    Currency:      data.waluta ?? 'PLN',
    InvoiceNumber: data.numer_faktury,
    InvoiceDate:   data.data_wystawienia,
    LineItems:     data.pozycje,
  });
  return (resp.data as { ErpRef: string }).ErpRef;
}

async function setStatus(
  id: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const fields = Object.keys(extra);
  const values: unknown[] = [status, id];
  const sets   = fields.map((f, i) => `${f} = $${i + 3}`);
  fields.forEach((f) => values.splice(2 + fields.indexOf(f), 0, extra[f]));

  await pool.query(
    `UPDATE invoices SET status = $1 ${sets.length ? ', ' + sets.join(', ') : ''} WHERE id = $2`,
    values,
  );

  try {
    await axios.post(`${API_URL}/api/internal/broadcast`, {
      invoiceId: id,
      type: 'status_update',
      data: { status, ...extra },
    });
  } catch {
    // broadcast failure is non-critical
  }
}

async function processInvoice(job: Job<InvoiceJobData>): Promise<void> {
  const { invoiceId } = job.data;

  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
  if (!rows.length) throw new Error(`Faktura ${invoiceId} nie istnieje`);
  const invoice = rows[0];

  await setStatus(invoiceId, 'processing');

  const prompt = `Przeanalizuj poniższą fakturę i zwróć TYLKO poprawny JSON (bez markdown, bez komentarzy).

Wymagana struktura:
{
  "seller": { "nazwa": "...", "nip": "..." },
  "buyer":  { "nazwa": "...", "nip": "..." },
  "numer_faktury": "...",
  "data_wystawienia": "YYYY-MM-DD",
  "kwota_brutto": 0.00,
  "waluta": "PLN",
  "pozycje": [
    {
      "nazwa": "...",
      "ilosc": 0,
      "cena_netto": 0.00,
      "vat_rate": 23,
      "brutto": 0.00
    }
  ]
}

Zasady:
- seller = sprzedawca (wystawca), buyer = nabywca
- Przepisuj DOKŁADNIE liczby które są wydrukowane na fakturze, nie licz niczego samodzielnie
- cena_netto = cena jednostkowa netto
- brutto = wartość brutto pozycji — przepisz, nie licz
- kwota_brutto = łączna kwota "Do zapłaty" lub "Razem brutto"
- ilosc = liczba (tylko cyfry, bez jednostek)
- vat_rate = liczba całkowita (23, 8, 5, 0)
- NIP = tylko cyfry, bez myślników i spacji
- data_wystawienia = format YYYY-MM-DD

Tekst faktury:
${invoice.raw_text}`;

  const t0 = Date.now();
  let extracted: ExtractedData;

  try {
    const aiResp = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      format: 'json',
      stream: false,
    });
    extracted = JSON.parse((aiResp.data as { response: string }).response) as ExtractedData;

    if (Array.isArray(extracted.pozycje)) computeNetto(extracted.pozycje);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(invoiceId, 'needs_review', { error_msg: `Błąd AI: ${msg}` });
    return;
  }

  const processingMs = Date.now() - t0;

  const { errors, notes } = validate(extracted);

  extracted._model            = OLLAMA_MODEL;
  extracted._processing_ms    = processingMs;
  extracted._validation_ok    = errors.length === 0;
  extracted._validation_notes = [...notes, ...errors];

  if (errors.length > 0) {
    await setStatus(invoiceId, 'needs_review', {
      extracted: JSON.stringify(extracted),
      error_msg: errors.join(' | '),
    });
    return;
  }

  let erpRef: string;
  try {
    erpRef = await sendToErp(invoiceId, extracted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(invoiceId, 'needs_review', {
      extracted: JSON.stringify(extracted),
      error_msg: `Błąd ERP: ${msg}`,
    });
    return;
  }

  await setStatus(invoiceId, 'done', {
    extracted: JSON.stringify(extracted),
    erp_ref:   erpRef,
  });
}

const worker = new Worker<InvoiceJobData>('invoice-processing', processInvoice, {
  connection: redis,
  concurrency: 3,
});

worker.on('failed', (job, err) => console.error(`job ${job?.id} failed:`, err.message));

console.log('worker ready');
