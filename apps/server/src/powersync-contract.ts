import { z } from "zod";

const titleSchema = z.string().trim().min(1).max(200);
const clientMetadataSchema = {
  user_id: z.string().max(128).optional(),
  created_at: z.string().max(64).optional(),
  updated_at: z.string().max(64).optional(),
};

const putOperationSchema = z.object({
  id: z.string().min(1).max(128),
  table: z.literal("item"),
  op: z.literal("PUT"),
  opData: z.object({ title: titleSchema, ...clientMetadataSchema }).strict(),
});

const patchOperationSchema = z
  .object({
    id: z.string().min(1).max(128),
    table: z.literal("item"),
    op: z.literal("PATCH"),
    opData: z.object({ title: titleSchema.optional(), ...clientMetadataSchema }).strict(),
  })
  .refine((operation) => Object.keys(operation.opData).length > 0, {
    message: "PATCH must include a supported field",
    path: ["opData"],
  });

const deleteOperationSchema = z.object({
  id: z.string().min(1).max(128),
  table: z.literal("item"),
  op: z.literal("DELETE"),
});

export const uploadOperationSchema = z.discriminatedUnion("op", [
  putOperationSchema,
  patchOperationSchema,
  deleteOperationSchema,
]);

export const uploadPayloadSchema = z
  .object({ operations: z.array(uploadOperationSchema).min(1).max(50) })
  .strict();

export type UploadOperation = z.infer<typeof uploadOperationSchema>;
