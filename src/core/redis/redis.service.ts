import { Injectable, Inject, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from '../constants.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient,
  ) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, { EX: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
      this.logger.log(`Invalidated ${keys.length} key(s) matching pattern: ${pattern}`);
    }
  }

  async ping(): Promise<string> {
    if (!this.client || !this.client.isOpen) {
      throw new Error('Redis client is not connected');
    }
    return this.client.ping() as Promise<string>;
  }
}
