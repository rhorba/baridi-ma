import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Stub service (Story 4.1 not yet built) — no coverage gate until real logic lands.
    passWithNoTests: true,
  },
});
