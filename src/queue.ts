import { Queue } from 'bullmq';
import redis from './redis';

export interface InvoiceJobData {
  invoiceId: string;
}

const invoiceQueue = new Queue<InvoiceJobData>('invoice-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export default invoiceQueue;
