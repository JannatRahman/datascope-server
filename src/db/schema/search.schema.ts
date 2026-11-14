
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";
import { datasets } from "./dataset.schema.js";

// Search History
export const searchHistory = pgTable(
  "search_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    datasetId: uuid("dataset_id").references(() => datasets.id, {
      onDelete: "set null",
    }),

    searchQuery: text("search_query").notNull(),

    // Filters applied during the search
    filters: jsonb("filters")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    // Sorting configuration
    sortConfig: jsonb("sort_config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    // Number of matching records
    resultCount: integer("result_count").default(0).notNull(),

    // Time taken to execute the search (milliseconds)
    executionTimeMs: integer("execution_time_ms"),

    searchedAt: timestamp("searched_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("search_history_user_id_idx").on(table.userId),
    index("search_history_dataset_id_idx").on(table.datasetId),
    index("search_history_searched_at_idx").on(table.searchedAt),
  ]
);
