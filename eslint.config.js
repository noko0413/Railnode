import js from "@eslint/js";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function onlyTypeScript(configs) {
  return configs.map((cfg) => ({
    ...cfg,
    files: ["**/*.ts"],
  }));
}

function onlyJavaScript(cfg) {
  return {
    ...cfg,
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
  };
}

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // Base JS rules — scoped to JS files.
  onlyJavaScript(js.configs.recommended),

  // Node globals for JS scripts/tools.
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript (type-aware) — scoped to TS files only.
  ...onlyTypeScript(tseslint.configs.recommendedTypeChecked),
  ...onlyTypeScript(tseslint.configs.stylisticTypeChecked),

  // TypeScript (type-aware) for any TS project in this repo.
  // Using the project service avoids having to hardcode every tsconfig path
  // and prevents VS Code ESLint from producing "error"-typed values when
  // a new app folder is added.
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Very strict, type-aware rules.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",

      // Prefer unused vars errors from TS compiler (already enabled)
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
