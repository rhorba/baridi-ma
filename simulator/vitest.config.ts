import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // MQTT wiring / env parsing is infrastructure glue, not business logic.
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts"],
    },
  },
});
