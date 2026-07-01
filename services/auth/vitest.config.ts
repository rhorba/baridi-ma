import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Server bootstrap (plugin registration, listen()) is infrastructure wiring,
      // not business logic — same tier as web's excluded config/layout files.
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts"],
    },
  },
});
