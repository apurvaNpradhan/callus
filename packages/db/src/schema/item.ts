import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const item = pgTable(
  "item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("item_user_id_idx").on(table.userId)],
);
