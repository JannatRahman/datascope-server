import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { databaseProviders } from './database.provider.js';
import { PG_POOL, DRIZZLE_DB } from '../constants.js';

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [PG_POOL, DRIZZLE_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    console.log(`[DatabaseModule] Closing PostgreSQL connection pool (signal: ${signal ?? 'shutdown'})...`);
    await this.pool.end();
    console.log('[DatabaseModule] PostgreSQL connection pool closed successfully.');
  }
}
