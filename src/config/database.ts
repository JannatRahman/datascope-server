
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from environment variables");
}

export const pool = new Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(pool);
