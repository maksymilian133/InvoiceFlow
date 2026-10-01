import { Router } from 'express';
import invoicesRouter from './invoices';
import internalRouter from './internal';

const router = Router();

router.use('/invoices', invoicesRouter);
router.use('/internal', internalRouter);

export default router;
