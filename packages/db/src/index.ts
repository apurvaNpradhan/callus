import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@callus/env/server";

import { authRelations } from "./schema/auth";
import { appRelations } from "./schema/relations";

const relations = { ...appRelations, ...authRelations };

function createDatabase() {
  return drizzle({ client: getDatabasePool(), relations });
}

type Database = ReturnType<typeof createDatabase>;

let pool: Pool | undefined;
let database: Database | undefined;

export function getDatabasePool() {
  pool ??= new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDatabase(), property, receiver);
    return typeof value === "function" ? value.bind(getDatabase()) : value;
  },
});

export { applyItemOperations, type ItemUploadOperation } from "./powersync";
