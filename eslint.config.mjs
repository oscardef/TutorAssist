import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next 16.4 turned these React Compiler and link rules into
  // errors. They flag patterns that predate the Mathium rewrite (state set in
  // effects, refs read during render, <a> to API routes). Kept as warnings
  // until the touched components are reworked; do not add new occurrences.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off operational scripts (CommonJS), not part of the app.
    "scripts/**",
  ]),
]);

export default eslintConfig;
