import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

import type { AppRouterClient } from "@callus/api/routers/index";

import { authClient } from "@/lib/auth-client";
import { serverUrl } from "@/lib/server-url";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.log(error);
    },
  }),
});

async function expoFetch(url: string, init?: RequestInit) {
  const { fetch } = await import("expo/fetch");

  return fetch(url, init);
}

const rpcUrl = new URL("/rpc", serverUrl);

export const link = new RPCLink({
  origin: rpcUrl.origin,
  url: "/rpc",
  fetch(url, init) {
    return expoFetch(url, {
      ...init,
      // Better Auth Expo forwards the session cookie manually on native.
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
  },
  async headers() {
    if (Platform.OS === "web") {
      return {};
    }
    const headers = new Map<string, string>();
    const cookies = await authClient.getCookie();
    if (cookies) {
      headers.set("Cookie", cookies);
    }
    return Object.fromEntries(headers);
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
