// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // Every ad request must go through src/config/ads.ts so iOS requests carry
  // requestNonPersonalizedAdsOnly (no ATT prompt, no tracking). Type-only
  // imports of the SDK are fine.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { paths: [{
        name: 'react-native-google-mobile-ads',
        allowTypeImports: true,
        message: 'Request ads through src/config/ads.ts (getAdsModule / renderBannerAd / createInterstitialAd) so every iOS request carries requestNonPersonalizedAdsOnly. Type-only imports are fine.',
      }] }],
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.name='require'][arguments.0.value='react-native-google-mobile-ads']", message: 'Use src/config/ads.ts' },
        { selector: "ImportExpression[source.value='react-native-google-mobile-ads']", message: 'Use src/config/ads.ts' },
      ],
    },
  },
  {
    files: ['src/config/ads.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },
]);
