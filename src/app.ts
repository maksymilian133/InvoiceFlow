import express from 'express';
import { logger } from './middleware/logger';
import { notFound, errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/index';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
