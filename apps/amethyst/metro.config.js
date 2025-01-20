// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const path = require("path");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.cacheStores = [
  new FileStore({
    root: path.join(__dirname, "node_modules", ".cache", "metro"),
  }),
];

module.exports = withNativeWind(config, { input: "./global.css" });
