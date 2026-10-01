import 'dotenv/config';
import http from 'http';
import app from './app';
import { migrate } from './migrate';
import { initWss } from './ws';

const PORT = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  await migrate();

  const server = http.createServer(app);
  initWss(server);

  server.listen(PORT, () => {
    console.log(`listening on http://localhost:${PORT}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal}: shutting down`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('startup error:', err);
  process.exit(1);
});
