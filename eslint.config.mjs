import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...require("eslint-config-next/core-web-vitals"),
  ...require("eslint-config-next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      "import/no-anonymous-default-export": "warn",
    },
  },
  {
    files: [
      "**/tailwind.config.*",
      "**/next.config.*",
      "**/postcss.config.*",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
