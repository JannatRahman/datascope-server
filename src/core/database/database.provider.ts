import { Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { PG_POOL, DRIZZLE_DB } from '../constants.js';

export const databaseProviders: Provider[] = [
  {
    provide: PG_POOL,
    useFactory: (): Pool => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is missing from environment variables');
      }
      return new Pool({
        connectionString,
        max: 10,
      });
    },
  },
  {
    provide: DRIZZLE_DB,
    inject: [PG_POOL],
    useFactory: (pool: Pool): NodePgDatabase<typeof schema> => {
      return drizzle(pool, { schema });
    },
  },
];
