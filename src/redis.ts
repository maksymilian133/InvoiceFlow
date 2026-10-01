import IORedis from 'ioredis';

const redis = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => console.error('redis error:', err));

export default redis;
