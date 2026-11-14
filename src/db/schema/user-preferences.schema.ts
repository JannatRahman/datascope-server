
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";

// Stores individual user interface and dashboard preferences
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Appearance preferences
    theme: varchar("theme", { length: 20 })
      .notNull()
      .default("system"),

    tableDensity: varchar("table_density", { length: 20 })
      .notNull()
      .default("comfortable"),

    // Table and navigation preferences
    defaultPageSize: integer("default_page_size")
      .notNull()
      .default(25),

    sidebarCollapsed: boolean("sidebar_collapsed")
      .notNull()
      .default(false),

    // Additional dashboard and display configuration
    dashboardLayout: jsonb("dashboard_layout")
      .notNull()
      .default({}),

    additionalPreferences: jsonb("additional_preferences")
      .notNull()
      .default({}),

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
    uniqueIndex("user_preferences_user_id_unique").on(table.userId),
  ]
);
