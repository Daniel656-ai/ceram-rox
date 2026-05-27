import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Enforce: all backend access must go through src/lib/api.
      // The supabase client may only be imported inside src/lib/api/** and
      // src/integrations/supabase/** (and as a type-only import elsewhere).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "Do not import the supabase client directly. Use `import { api } from '@/lib/api'` instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // The API layer itself and the auto-generated integration are allowed to
    // talk to the supabase client.
    files: ["src/lib/api/**", "src/integrations/supabase/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);

