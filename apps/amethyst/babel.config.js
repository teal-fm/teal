module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo"],
      "nativewind/babel",
    ],
    plugins: [
      ['babel-plugin-react-compiler', { target: '18' }],
      [
        'module-resolver',
        {
          alias: {
            "@": "./",
            "~": "./"
          },
        }
      ],
      [
        "@babel/plugin-transform-react-jsx",
        {
          runtime: "automatic",
          importSource: "nativewind",
        },
      ],
      '@babel/plugin-transform-export-namespace-from',
      'react-native-reanimated/plugin'
    ]
  };
};
