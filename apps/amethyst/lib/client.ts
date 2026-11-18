import AsyncStorage from "@react-native-async-storage/async-storage";

import { configureClient } from "@teal/client/config";
import { createQueryClient } from "@teal/client/query";

// Runs before anything fetches or reads storage: app/_layout imports this first.
configureClient({
  aquaUrl: process.env.EXPO_PUBLIC_AQUA_URL || process.env.EXPO_PUBLIC_APPVIEW_URL || "",
  publicOrigin: process.env.EXPO_PUBLIC_BASE_URL || "https://teal.fm",
  storage: AsyncStorage,
});

export const queryClient = createQueryClient();
