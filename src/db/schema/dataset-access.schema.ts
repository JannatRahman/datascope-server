
import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema.js";
import { datasets } from "./dataset.schema.js";

// Dataset-specific access levels
export const datasetAccessLevelEnum = pgEnum(
  "dataset_access_level",
  ["viewer", "editor", "manager"]
);

// Users who have access to individual datasets
export const datasetMembers = pgTable(
  "dataset_members",
  {
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    accessLevel: datasetAccessLevelEnum("access_level")
      .default("viewer")
      .notNull(),

    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),

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
    primaryKey({
      columns: [table.datasetId, table.userId],
    }),

    index("dataset_members_user_id_idx").on(table.userId),

    index("dataset_members_access_level_idx").on(table.accessLevel),
  ]
);
