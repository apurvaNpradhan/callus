import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { item } from "./schema/item";

export type ItemUploadOperation =
  | { id: string; op: "PUT"; title: string }
  | { id: string; op: "PATCH"; title?: string }
  | { id: string; op: "DELETE" };

export async function applyItemOperations(
  userId: string,
  operations: readonly ItemUploadOperation[],
) {
  const rejected: string[] = [];

  await db.transaction(async (tx) => {
    for (const operation of operations) {
      const now = new Date();
      if (operation.op === "DELETE") {
        const [deleted] = await tx
          .delete(item)
          .where(and(eq(item.id, operation.id), eq(item.userId, userId)))
          .returning({ id: item.id });
        if (!deleted) rejected.push(operation.id);
      } else if (operation.op === "PUT") {
        const [written] = await tx
          .insert(item)
          .values({
            id: operation.id,
            userId,
            title: operation.title,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: item.id,
            set: { title: operation.title, updatedAt: now },
            setWhere: eq(item.userId, userId),
          })
          .returning({ id: item.id });
        if (!written) rejected.push(operation.id);
      } else if (operation.title !== undefined) {
        const [updated] = await tx
          .update(item)
          .set({ title: operation.title, updatedAt: now })
          .where(and(eq(item.id, operation.id), eq(item.userId, userId)))
          .returning({ id: item.id });
        if (!updated) rejected.push(operation.id);
      } else {
        rejected.push(operation.id);
      }
    }
  });

  return rejected;
}
