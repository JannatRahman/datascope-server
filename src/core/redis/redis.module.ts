import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { redisProviders } from './redis.provider.js';
import { RedisService } from './redis.service.js';
import { REDIS_CLIENT } from '../constants.js';
import type { RedisClientType } from 'redis';

@Global()
@Module({
  providers: [...redisProviders, RedisService],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    console.log(`[NestJS] RedisModule shutting down (signal: ${signal ?? 'none'})`);
    try {
      const client = this.moduleRef.get<RedisClientType>(REDIS_CLIENT, { strict: false });
      if (client) {
        await client.disconnect();
        console.log('[NestJS] Redis connection closed.');
      }
    } catch {
      // Client may already be disconnected
    }
  }
}
