import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**", // Utility/migration scripts with CommonJS require()
      "coverage/**", // Test coverage reports
      ".backup-20251017/**", // Legacy backup folder
      ".claudeCode/**", // Claude Code skills
      "chrome-devtools-mcp/**", // External MCP server
      "playwright-report/**", // Playwright test reports
      "docs/manual/**", // Manual documentation scripts
      "analyze_excel*.js", // Root-level analysis scripts
    ],
  },
];

export default eslintConfig;
