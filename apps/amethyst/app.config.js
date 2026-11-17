import pkg from "./package.json";

/**
 * Sign-in redirects to the public origin's host reversed, as the AT Protocol
 * OAuth profile requires for native clients (`teal.fm` → `fm.teal`). It must
 * match nativeCallbackScheme() in @teal/client/atp/nativeOAuth.
 */
function oauthScheme() {
  const origin = process.env.EXPO_PUBLIC_BASE_URL;

  if (!origin) return undefined;

  const { hostname } = new URL(origin);

  if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;

  return hostname.split(".").reverse().join(".");
}

export default () => {
  const VERSION = pkg.version;
  const callbackScheme = oauthScheme();

  return {
    /** @type {import('@expo/config-types').ExpoConfig} */
    expo: {
      name: "amethyst",
      slug: "amethyst",
      version: VERSION,
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      scheme: callbackScheme ? ["fm.teal.amethyst", callbackScheme] : "fm.teal.amethyst",
      // Android only: the web app is apps/web and the iOS app is apps/ios (SwiftUI).
      platforms: ["android"],
      userInterfaceStyle: "automatic",
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      android: {
        package: "fm.teal.amethyst",
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
      },
      plugins: [
        [
          "expo-dev-client",
          {
            launchMode: "most-recent",
          },
        ],
        "expo-font",
        [
          "expo-sqlite",
          {
            useSQLCipher: true,
          },
        ],
        "expo-build-properties",
        "expo-router",
        "expo-web-browser",
        "expo-splash-screen",
        "expo-status-bar",
      ],
      experiments: {
        reactCompiler: true,
      },
    },
  };
};
