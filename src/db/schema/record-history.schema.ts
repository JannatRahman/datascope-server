
import {
  pgTable,
  uuid,
  pgEnum,
  jsonb,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";
import { datasets, datasetRecords } from "./dataset.schema.js";

// Types of changes made to records
export const recordChangeTypeEnum = pgEnum(
  "record_change_type",
  ["created", "updated", "deleted"]
);

// Stores historical versions of dataset records
export const recordHistory = pgTable(
  "record_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    recordId: uuid("record_id")
      .notNull()
      .references(() => datasetRecords.id, { onDelete: "restrict" }),

    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "restrict" }),

    changedBy: text("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),

    changeType: recordChangeTypeEnum("change_type").notNull(),

    previousData: jsonb("previous_data"),

    newData: jsonb("new_data"),

    changeDescription: text("change_description"),

    changedAt: timestamp("changed_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("record_history_record_id_idx").on(table.recordId),

    index("record_history_dataset_id_idx").on(table.datasetId),

    index("record_history_changed_at_idx").on(table.changedAt),

    index("record_history_record_changed_at_idx").on(
      table.recordId,
      table.changedAt
    ),
  ]
);
