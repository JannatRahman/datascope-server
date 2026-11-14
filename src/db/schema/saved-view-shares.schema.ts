import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema.js";
import { savedViews } from "./saved-views.schema.js";

// Controls which users can access a shared saved view
export const savedViewShares = pgTable(
  "saved_view_shares",
  {
    savedViewId: uuid("saved_view_id")
      .notNull()
      .references(() => savedViews.id, { onDelete: "cascade" }),

    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    sharedByUserId: text("shared_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.savedViewId, table.sharedWithUserId],
    }),

    index("saved_view_shares_user_id_idx").on(
      table.sharedWithUserId
    ),

    index("saved_view_shares_shared_by_idx").on(
      table.sharedByUserId
    ),
  ]
);
