module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo"]],
    plugins: [
      ["babel-plugin-react-compiler", { target: "19" }],
      [
        "module-resolver",
        {
          alias: {
            "@": "./",
            "~": "./",
          },
        },
      ],
      "@babel/plugin-transform-export-namespace-from",
      "react-native-reanimated/plugin",
    ],
  };
};
