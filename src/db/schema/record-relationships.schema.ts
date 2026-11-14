
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { datasets, datasetRecords } from "./dataset.schema.js";

// Stores relationships between records
export const recordRelationships = pgTable(
  "record_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Source record
    sourceDatasetId: uuid("source_dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    sourceRecordId: uuid("source_record_id")
      .notNull()
      .references(() => datasetRecords.id, { onDelete: "cascade" }),

    // Related record
    targetDatasetId: uuid("target_dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    targetRecordId: uuid("target_record_id")
      .notNull()
      .references(() => datasetRecords.id, { onDelete: "cascade" }),

    relationshipType: varchar("relationship_type", {
      length: 100,
    }).notNull(),

    description: text("description"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("record_relationships_source_idx").on(
      table.sourceRecordId
    ),

    index("record_relationships_target_idx").on(
      table.targetRecordId
    ),

    index("record_relationships_source_dataset_idx").on(
      table.sourceDatasetId
    ),

    index("record_relationships_target_dataset_idx").on(
      table.targetDatasetId
    ),
  ]
);
