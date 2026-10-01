import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import axios from 'axios';
import pool from '../db';
import invoiceQueue from '../queue';

const ERP_URL = process.env.ERP_URL ?? 'http://localhost:3001';

const router = Router();

function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data        = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf         = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text    = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => (item.str ?? '') + (item.hasEOL ? '\n' : ' '))
      .join('');
    pageTexts.push(text);
  }

  return pageTexts.join('\n\n');
}

async function extractText(file: Express.Multer.File): Promise<string> {
  const isPdf =
    file.mimetype === 'application/pdf' ||
    file.originalname.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    try {
      const text  = await extractTextFromPdf(file.buffer);
      const clean = sanitizeText(text);
      if (clean.length > 10) return clean;
      throw new Error('PDF nie zawiera tekstu — może to skan (obraz)');
    } catch (err) {
      throw new Error(`Nie udało się odczytać tekstu z PDF: ${(err as Error).message}`);
    }
  }

  return sanitizeText(file.buffer.toString('utf-8'));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const isPdf  = name.endsWith('.pdf') || file.mimetype === 'application/pdf';
    const isTxt  = name.endsWith('.txt') || file.mimetype === 'text/plain';
    const isOctet = file.mimetype === 'application/octet-stream' && isPdf;
    cb(null, isPdf || isTxt || isOctet);
  },
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
    res.json({ count: rows.length, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Nie znaleziono faktury' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});


router.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let rawText: string | undefined;
      let filename: string | undefined;

      if (req.file) {
        filename = req.file.originalname;
        try {
          rawText = await extractText(req.file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return res.status(422).json({ error: `Nie udało się odczytać tekstu z pliku: ${msg}` });
        }
      } else {
        rawText = (req.body as { text?: string }).text;
      }

      if (!rawText || rawText.trim().length === 0) {
        return res.status(400).json({ error: 'Wymagane pole "text" lub plik z fakturą' });
      }

      // Duplikat check — hash SHA-256 z treści
      const crypto  = await import('crypto');
      const hash    = crypto.createHash('sha256').update(rawText.trim()).digest('hex');
      const existing = await pool.query(
        `SELECT id, filename, status FROM invoices WHERE content_hash = $1 LIMIT 1`,
        [hash],
      );
      if (existing.rows.length) {
        const dup = existing.rows[0] as { id: string; filename: string | null; status: string };
        return res.status(409).json({
          error: `Duplikat: taka faktura już istnieje (${dup.filename ?? 'tekst'}, status: ${dup.status})`,
          duplicateId: dup.id,
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO invoices (raw_text, filename, content_hash) VALUES ($1, $2, $3) RETURNING *`,
        [rawText.trim(), filename ?? null, hash],
      );
      const invoice = rows[0];

      await invoiceQueue.add('process', { invoiceId: invoice.id });

      res.status(201).json(invoice);
    } catch (err) { next(err); }
  },
);

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, extracted } = req.body as { status?: string; extracted?: unknown };

    const allowed = ['pending', 'processing', 'done', 'needs_review', 'rejected'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: `Nieprawidłowy status. Dozwolone: ${allowed.join(', ')}` });
    }

    const { rows } = await pool.query(
      `UPDATE invoices
          SET status    = COALESCE($1, status),
              extracted = COALESCE($2::jsonb, extracted)
        WHERE id = $3
        RETURNING *`,
      [status ?? null, extracted ? JSON.stringify(extracted) : null, req.params.id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Nie znaleziono faktury' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Nie znaleziono faktury' });

    const invoice = rows[0];
    if (!invoice.extracted) return res.status(400).json({ error: 'Brak danych do zatwierdzenia' });

    const extracted = invoice.extracted as Record<string, unknown>;

    const erpResp = await axios.post(`${ERP_URL}/odata/v1/Invoices`, {
      InvoiceId:     invoice.id,
      Vendor:        (extracted.seller as { nazwa: string })?.nazwa,
      VendorTaxId:   (extracted.seller as { nip: string })?.nip,
      Buyer:         (extracted.buyer as { nazwa: string })?.nazwa,
      BuyerTaxId:    (extracted.buyer as { nip: string })?.nip,
      GrossAmount:   extracted.kwota_brutto,
      Currency:      extracted.waluta ?? 'PLN',
      InvoiceNumber: extracted.numer_faktury,
      InvoiceDate:   extracted.data_wystawienia,
      LineItems:     extracted.pozycje,
    });
    const erpRef = (erpResp.data as { ErpRef: string }).ErpRef;

    const { rows: updated } = await pool.query(
      `UPDATE invoices SET status = 'done', erp_ref = $1, error_msg = NULL WHERE id = $2 RETURNING *`,
      [erpRef, req.params.id],
    );

    try {
      await axios.post(`${process.env.API_URL ?? 'http://localhost:3000'}/api/internal/broadcast`, {
        invoiceId: req.params.id,
        type: 'status_update',
        data: { status: 'done' },
      });
    } catch { /* non-critical */ }

    res.json(updated[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, rowCount } = await pool.query(
      'DELETE FROM invoices WHERE id = $1 RETURNING erp_ref',
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Nie znaleziono faktury' });

    const erpRef = rows[0]?.erp_ref as string | null;
    if (erpRef) {
      axios.delete(`${ERP_URL}/odata/v1/Invoices('${req.params.id}')`).catch(() => null);
    }

    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
