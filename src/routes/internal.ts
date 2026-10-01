import { Router, Request, Response } from 'express';
import { broadcast } from '../ws';

const router = Router();

router.post('/broadcast', (req: Request, res: Response) => {
  const { invoiceId, type, data } = req.body as {
    invoiceId: string;
    type: string;
    data: Record<string, unknown>;
  };

  if (!invoiceId || !type) {
    res.status(400).json({ error: 'invoiceId i type są wymagane' });
    return;
  }

  broadcast(invoiceId, type, data ?? {});
  res.json({ ok: true });
});

export default router;
