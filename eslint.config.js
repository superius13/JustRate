// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // gluestack-ui components are kept as the CLI writes them; Edge Functions run on Deno, not in the app.
    ignores: ['dist/*', 'src/components/ui/**', 'supabase/functions/**'],
  },
]);
