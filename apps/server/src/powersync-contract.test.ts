import assert from "node:assert/strict";
import test from "node:test";

import { uploadPayloadSchema } from "./powersync-contract";

test("PowerSync upload contract only accepts bounded item mutations", () => {
  const valid = uploadPayloadSchema.safeParse({
    operations: [
      {
        id: "item-1",
        table: "item",
        op: "PATCH",
        opData: { title: "Renamed", user_id: "client-value", updated_at: new Date().toISOString() },
      },
    ],
  });
  assert.equal(valid.success, true);

  const untrusted = uploadPayloadSchema.safeParse({
    operations: [
      {
        id: "item-1",
        table: "user",
        op: "PUT",
        opData: { title: "Nope", user_id: "someone-else" },
      },
    ],
  });
  assert.equal(untrusted.success, false);
});
