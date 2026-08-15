import { useCallback, useEffect } from "react";
import { useColorScheme as useNativewindColorScheme } from "nativewind";

const COLOR_SCHEME_STORAGE_KEY = "teal-color-scheme";
type ThemePreference = "light" | "dark" | "system";

function getStoredColorScheme(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedColorScheme = window.localStorage.getItem(
      COLOR_SCHEME_STORAGE_KEY,
    );

    if (
      storedColorScheme === "light" ||
      storedColorScheme === "dark" ||
      storedColorScheme === "system"
    ) {
      return storedColorScheme;
    }
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }

  return null;
}

export function useColorScheme() {
  const nativewind = useNativewindColorScheme();
  const storedColorScheme = getStoredColorScheme();

  const setColorScheme = useCallback(
    (nextColorScheme: ThemePreference) => {
      nativewind.setColorScheme(nextColorScheme);

      if (typeof window === "undefined") {
        return;
      }

      try {
        if (nextColorScheme === "system") {
          window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
        } else {
          window.localStorage.setItem(
            COLOR_SCHEME_STORAGE_KEY,
            nextColorScheme,
          );
        }
      } catch {
        // localStorage can be unavailable in private or restricted browser contexts.
      }
    },
    [nativewind.setColorScheme],
  );

  useEffect(() => {
    if (
      storedColorScheme &&
      storedColorScheme !== "system" &&
      nativewind.colorScheme !== storedColorScheme
    ) {
      nativewind.setColorScheme(storedColorScheme);
    }
  }, [nativewind.colorScheme, nativewind.setColorScheme, storedColorScheme]);

  const colorScheme =
    nativewind.colorScheme ||
    (storedColorScheme === "system" ? null : storedColorScheme) ||
    "dark";
  const toggleColorScheme = useCallback(() => {
    setColorScheme(colorScheme === "dark" ? "light" : "dark");
  }, [colorScheme, setColorScheme]);

  return {
    colorScheme,
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
    toggleColorScheme,
  };
}
