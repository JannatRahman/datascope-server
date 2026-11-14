
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";

// Notification categories
export const notificationTypeEnum = pgEnum(
  "notification_type",
  [
    "export_completed",
    "export_failed",
    "saved_view_shared",
    "dataset_access_granted",
    "dataset_access_changed",
    "system",
  ]
);

// Stores notifications for individual users
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: notificationTypeEnum("type").notNull(),

    title: varchar("title", { length: 200 }).notNull(),

    message: text("message").notNull(),

    // Optional related resource information
    resourceType: varchar("resource_type", { length: 50 }),

    resourceId: uuid("resource_id"),

    metadata: jsonb("metadata").notNull().default({}),

    isRead: boolean("is_read").notNull().default(false),

    readAt: timestamp("read_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),

    index("notifications_user_read_idx").on(
      table.userId,
      table.isRead
    ),

    index("notifications_created_at_idx").on(table.createdAt),
  ]
);
