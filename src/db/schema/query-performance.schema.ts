
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";
import { datasets } from "./dataset.schema.js";

// Types of operations being monitored
export const performanceOperationEnum = pgEnum(
  "performance_operation",
  [
    "search",
    "filter",
    "sort",
    "pagination",
    "export",
    "analytics",
    "other",
  ]
);

// Stores query and operation performance metrics
export const queryPerformanceLogs = pgTable(
  "query_performance_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    datasetId: uuid("dataset_id").references(() => datasets.id, {
      onDelete: "set null",
    }),

    operation: performanceOperationEnum("operation").notNull(),

    endpoint: varchar("endpoint", { length: 255 }),

    executionTimeMs: integer("execution_time_ms").notNull(),

    recordsReturned: integer("records_returned").notNull().default(0),

    cacheHit: boolean("cache_hit").notNull().default(false),

    // Optional information about the operation
    metadata: jsonb("metadata").notNull().default({}),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("query_performance_operation_idx").on(table.operation),

    index("query_performance_execution_time_idx").on(
      table.executionTimeMs
    ),

    index("query_performance_dataset_idx").on(table.datasetId),

    index("query_performance_created_at_idx").on(table.createdAt),

    index("query_performance_cache_hit_idx").on(table.cacheHit),
  ]
);
