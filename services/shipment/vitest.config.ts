import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Server bootstrap (plugin registration, listen()) is infrastructure wiring,
      // not business logic — same tier as auth-service's excluded main.ts.
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
