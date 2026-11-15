
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";
import { datasets } from "./dataset.schema.js";

// Export job lifecycle
export const exportJobStatusEnum = pgEnum(
  "export_job_status",
  ["pending", "processing", "completed", "failed", "cancelled"]
);

// Supported export formats
export const exportFormatEnum = pgEnum(
  "export_format",
  ["csv", "json"]
);

// Stores background data export requests
export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),

    status: exportJobStatusEnum("status")
      .notNull()
      .default("pending"),

    format: exportFormatEnum("format")
      .notNull()
      .default("csv"),

    // The filters and sorting used for this export
    exportConfig: jsonb("export_config")
      .notNull()
      .default({}),

    // Generated file information
    filePath: text("file_path"),

    fileName: text("file_name"),

    totalRecords: integer("total_records"),

    processedRecords: integer("processed_records")
      .notNull()
      .default(0),

    errorMessage: text("error_message"),

    requestedAt: timestamp("requested_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("export_jobs_user_id_idx").on(table.userId),

    index("export_jobs_dataset_id_idx").on(table.datasetId),

    index("export_jobs_status_idx").on(table.status),

    index("export_jobs_requested_at_idx").on(table.requestedAt),

    index("export_jobs_user_status_idx").on(
      table.userId,
      table.status
    ),
  ]
);
