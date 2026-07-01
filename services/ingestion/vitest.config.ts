import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Server bootstrap (plugin registration, listen(), starting the MQTT
      // subscriber) is infrastructure wiring, not business logic.
      exclude: [...coverageConfigDefaults.exclude, "src/main.ts"],
    },
  },
});
