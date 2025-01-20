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
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "fm.teal.amethyst",
      },
      android: {
        package: "fm.teal.amethyst",
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
      },
      web: {
        bundler: "metro",
        output: "single",
        favicon: "./assets/images/favicon.png",
      },
      plugins: [
        "expo-font",
        [
          "expo-sqlite",
          {
            useSQLCipher: true,
          },
        ],
      ],
      experiments: {
        reactCompiler: true,
      },
    },
  };
};
