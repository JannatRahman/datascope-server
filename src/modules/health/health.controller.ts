import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { RedisService } from '../../core/redis/redis.service.js';
import { PG_POOL } from '../../core/constants.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('database')
  async checkDatabase(): Promise<{ success: boolean; databaseTime?: string; error?: string }> {
    try {
      const result = await this.pool.query<{ now: Date }>('SELECT NOW()');
      const row = result.rows[0];
      return {
        success: true,
        databaseTime: row?.now?.toISOString() ?? 'unknown',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Get('redis')
  async checkRedis(): Promise<{ success: boolean; redis?: string; error?: string }> {
    try {
      const pong = await this.redisService.ping();
      return { success: true, redis: pong };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
