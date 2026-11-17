import pkg from "./package.json";

export default () => {
  const VERSION = pkg.version;

  return {
    /** @type {import('@expo/config-types').ExpoConfig} */
    expo: {
      name: "amethyst",
      slug: "amethyst",
      version: VERSION,
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      scheme: "fm.teal.amethyst",
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
