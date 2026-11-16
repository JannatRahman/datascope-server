import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";

// Global platform configuration and system preferences
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),

  value: jsonb("value")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
