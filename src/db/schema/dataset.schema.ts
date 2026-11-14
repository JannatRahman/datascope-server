
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";

// Dataset status
export const datasetStatusEnum = pgEnum("dataset_status", [
  "active",
  "archived",
]);

// Dynamic field data types
export const fieldDataTypeEnum = pgEnum("field_data_type", [
  "text",
  "number",
  "boolean",
  "date",
  "email",
  "url",
]);

// 1. Datasets
export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", { length: 255 }).notNull(),

    description: text("description"),

    category: varchar("category", { length: 100 }),

    dataSource: varchar("data_source", { length: 100 }),

    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),

    status: datasetStatusEnum("status")
      .default("active")
      .notNull(),

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

    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("datasets_owner_id_idx").on(table.ownerId),
    index("datasets_status_idx").on(table.status),
    index("datasets_created_at_idx").on(table.createdAt),
  ]
);

// 2. Dataset Fields
export const datasetFields = pgTable(
  "dataset_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    fieldKey: varchar("field_key", { length: 100 }).notNull(),

    fieldLabel: varchar("field_label", { length: 150 }).notNull(),

    dataType: fieldDataTypeEnum("data_type")
      .default("text")
      .notNull(),

    isRequired: boolean("is_required")
      .default(false)
      .notNull(),

    isSearchable: boolean("is_searchable")
      .default(false)
      .notNull(),

    isFilterable: boolean("is_filterable")
      .default(false)
      .notNull(),

    isSortable: boolean("is_sortable")
      .default(false)
      .notNull(),

    position: integer("position").default(0).notNull(),

    fieldConfig: jsonb("field_config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("dataset_fields_dataset_id_idx").on(table.datasetId),

    index("dataset_fields_created_at_idx").on(table.createdAt),

    index("dataset_fields_dataset_created_idx").on(
      table.datasetId,
      table.createdAt
    ),

    uniqueIndex("dataset_fields_dataset_id_id_unique").on(
      table.datasetId,
      table.id
    ),
  ]
);

// 3. Dataset Records
export const datasetRecords = pgTable(
  "dataset_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    recordData: jsonb("record_data")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    createdBy: text("created_by")
      .references(() => user.id),

    updatedBy: text("updated_by")
      .references(() => user.id),

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
    index("dataset_records_dataset_id_idx").on(table.datasetId),
    index("dataset_records_created_at_idx").on(table.createdAt),
    index("dataset_records_dataset_created_idx").on(
      table.datasetId,
      table.createdAt
    ),
  ]
);
