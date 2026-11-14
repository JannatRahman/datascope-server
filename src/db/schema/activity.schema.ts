
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";

// Activity categories
export const activityTypeEnum = pgEnum("activity_type", [
  "user",
  "dataset",
  "record",
  "authentication",
  "permission",
  "system",
]);

// 1. Activity Logs
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    activityType: activityTypeEnum("activity_type").notNull(),

    action: varchar("action", { length: 100 }).notNull(),

    description: text("description"),

    resourceType: varchar("resource_type", { length: 100 }),

    resourceId: uuid("resource_id"),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    ipAddress: varchar("ip_address", { length: 45 }),

    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activity_logs_user_id_idx").on(table.userId),
    index("activity_logs_activity_type_idx").on(table.activityType),
    index("activity_logs_created_at_idx").on(table.createdAt),
    index("activity_logs_resource_idx").on(
      table.resourceType,
      table.resourceId
    ),
  ]
);
