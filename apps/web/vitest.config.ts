import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      JWT_SECRET: "test-secret-for-web-unit-tests",
      INTERNAL_SERVICE_TOKEN: "test-internal-token",
    },
    coverage: {
      provider: "v8",
      // Presentation-layer files (pages, layout, React context/hooks, build config) are
      // E2E-tier per the Test Strategy's risk assessment, not unit/integration-tier —
      // verified instead via live manual E2E checks during Batch 3. Everything with real
      // request/auth logic (route handlers, lib/, middleware.ts) stays in scope.
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/app/**/page.tsx",
        "**/app/layout.tsx",
        "**/lib/auth-context.tsx",
        "**/components/**",
        "next.config.ts",
        "postcss.config.mjs",
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
