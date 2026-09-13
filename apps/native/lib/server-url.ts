import { env } from "@callus/env/native";

export const serverUrl = env.EXPO_PUBLIC_SERVER_URL.replace(/\/+$/, "");
