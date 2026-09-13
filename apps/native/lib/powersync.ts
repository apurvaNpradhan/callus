import { column, PowerSyncDatabase, Schema, Table } from "@powersync/react-native";
import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";
import { serverUrl } from "@/lib/server-url";

const item = new Table(
  {
    user_id: column.text,
    title: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ["user_id"] } },
);

export const AppSchema = new Schema({ item });
export type Item = (typeof AppSchema)["types"]["item"];

export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: "callus.db" },
});

const ownerKey = "callus-powersync-owner";
let transition = Promise.resolve();

async function transitionPowerSyncOwner(
  userId: string | null,
  offline: boolean,
): Promise<string | null> {
  const storedOwner = await SecureStore.getItemAsync(ownerKey);

  if (offline) {
    if (powerSync.connected || powerSync.connecting) {
      await powerSync.disconnect();
    }
    return storedOwner ?? null;
  }

  if (!userId) {
    if (storedOwner !== null || powerSync.connected || powerSync.connecting) {
      await powerSync.disconnectAndClear();
    }
    await SecureStore.deleteItemAsync(ownerKey);
    return null;
  }

  if (storedOwner !== userId) {
    await powerSync.disconnectAndClear();
    await SecureStore.setItemAsync(ownerKey, userId);
  }

  if (!powerSync.connected && !powerSync.connecting) {
    void powerSync.connect(powerSyncConnector).catch((error: unknown) => {
      console.log("PowerSync connection failed", error);
    });
  }
  return userId;
}

function queuePowerSyncOwnerTransition(userId: string | null, offline: boolean) {
  const next = transition.then(() => transitionPowerSyncOwner(userId, offline));
  transition = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function usePowerSyncSession(userId: string | null | undefined, offline = false) {
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [errorUserId, setErrorUserId] = useState<string | null>(null);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    if (userId === undefined && !offline) return;
    void queuePowerSyncOwnerTransition(userId ?? null, offline)
      .then((activeUserId) => {
        setReadyUserId(activeUserId);
        setErrorUserId(activeUserId);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setErrorUserId(userId ?? null);
        setError(nextError);
        console.log("PowerSync session transition failed", nextError);
      });
  }, [userId, offline]);

  return {
    activeUserId: offline || readyUserId === userId ? readyUserId : null,
    error: errorUserId === (userId ?? null) ? error : undefined,
    ready: offline || readyUserId === userId ? readyUserId !== null : false,
  };
}

async function nativeFetch(url: string, init?: RequestInit) {
  const { fetch } = await import("expo/fetch");
  return fetch(url, init);
}

async function cookies() {
  return Platform.OS === "web" ? undefined : authClient.getCookie();
}

export const powerSyncConnector: PowerSyncBackendConnector = {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const cookie = await cookies();
    const response = await nativeFetch(`${serverUrl}/powersync/credentials`, {
      headers: cookie ? { Cookie: cookie } : undefined,
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`PowerSync credentials failed (${response.status})`);
    const body = (await response.json()) as { endpoint: string; token: string };
    if (!body.endpoint || !body.token) throw new Error("PowerSync credentials were incomplete");
    return { endpoint: body.endpoint, token: body.token };
  },

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const cookie = await cookies();
    const operations = transaction.crud.map((operation) => ({
      id: operation.id,
      table: operation.table,
      op: operation.op,
      ...(operation.opData ? { opData: operation.opData } : {}),
    }));
    const response = await nativeFetch(`${serverUrl}/powersync/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ operations }),
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
    if (!response.ok) throw new Error(`PowerSync upload failed (${response.status})`);
    const result = (await response.json()) as { ok?: boolean };
    if (result.ok !== true) throw new Error("PowerSync upload was not handled");
    await transaction.complete();
  },
};
