import { useCallback, useEffect, useState } from "react";
import { Appearance, useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLOR_SCHEME_STORAGE_KEY = "teal-color-scheme";

export type ThemePreference = "light" | "dark" | "system";

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The app follows the system appearance unless a stored override is set. It is
 * applied through `Appearance`, which the style engine reads for `dark:` styles.
 */
function applyPreference(preference: ThemePreference) {
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

export async function restoreColorSchemePreference() {
  try {
    const stored = await AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY);

    if (isPreference(stored)) applyPreference(stored);
  } catch {
    // Storage can be unavailable; the system appearance still applies.
  }
}

export function useColorScheme() {
  const colorScheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
      .then((stored) => {
        if (isPreference(stored)) setPreference(stored);
      })
      .catch(() => undefined);
  }, []);

  const setColorScheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    applyPreference(next);

    const write =
      next === "system"
        ? AsyncStorage.removeItem(COLOR_SCHEME_STORAGE_KEY)
        : AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);

    write.catch(() => undefined);
  }, []);

  return {
    colorScheme,
    preference,
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
  };
}
