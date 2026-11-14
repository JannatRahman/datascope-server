import { Provider } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../constants.js';

export const redisProviders: Provider[] = [
  {
    provide: REDIS_CLIENT,
    useFactory: async (): Promise<RedisClientType> => {
      const client = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      });

      client.on('error', (err: Error) => {
        console.error('[RedisModule] Redis client error:', err);
      });

      try {
        await client.connect();
        console.log('[RedisModule] Connected to Redis successfully.');
      } catch (err) {
        console.warn('[RedisModule] WARNING: Could not connect to Redis at startup:', err instanceof Error ? err.message : String(err));
        console.warn('[RedisModule] App will start, but Redis-dependent features may fail.');
      }
      return client as RedisClientType;
    },
  },
];
