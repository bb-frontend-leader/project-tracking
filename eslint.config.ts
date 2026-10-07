import { defineConfig } from "eslint/config";
import importSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from "globals";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default defineConfig([
  { ignores: ["dist/**", "node_modules/**", "logs/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: {
      js,
      'simple-import-sort': importSort,
      'unused-imports': unusedImports,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Node.js built-in modules
            ['^(assert|buffer|child_process|cluster|crypto|dgram|dns|domain|events|fs|http|https|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|tls|tty|url|util|vm|zlib)(/.*|$)'],
            // External packages
            ['^[a-zA-Z0-9]', '^@?\\w'],
            // Internal packages
            ['^(@|src|lib|utils|config|models|controllers|services)(/.*|$)'],
            // Side effect imports
            ['^\\u0000'],
            // Parent imports
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Other relative imports
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$']
          ]
        },
      ],
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'warn',
    },
    extends: ["js/recommended"], languageOptions: { globals: globals.node }
  },
  tseslint.configs.recommended,
]);
