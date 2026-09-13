import { PowerSyncContext } from "@powersync/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { PanelUIProvider } from "panelui-native";

import { powerSync } from "@/lib/powersync";
import { queryClient } from "@/utils/orpc";

// oxlint-disable-next-line import/no-relative-parent-imports
import "../global.css";

export default function RootLayout() {
  return (
    <PowerSyncContext.Provider value={powerSync}>
      <PanelUIProvider>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </PanelUIProvider>
    </PowerSyncContext.Provider>
  );
}
