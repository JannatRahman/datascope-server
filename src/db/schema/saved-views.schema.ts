
import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";
import { datasets } from "./dataset.schema.js";

// Stores saved search configurations for users
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", { length: 150 }).notNull(),

    description: text("description"),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    // Search and filter configuration
    searchQuery: text("search_query"),

    filters: jsonb("filters").notNull().default({}),

    sortConfig: jsonb("sort_config").notNull().default([]),

    // User's selected table columns
    visibleColumns: jsonb("visible_columns").notNull().default([]),

    // Whether this view can be shared
    isShared: boolean("is_shared").notNull().default(false),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("saved_views_user_id_idx").on(table.userId),
    index("saved_views_dataset_id_idx").on(table.datasetId),
    index("saved_views_created_at_idx").on(table.createdAt),
    index("saved_views_user_dataset_idx").on(
      table.userId,
      table.datasetId
    ),
  ]
);
