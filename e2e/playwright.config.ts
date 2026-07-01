import { defineConfig } from "@playwright/test";

// CLAUDE.md rule 9: video recording at every project version completion.
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    video: "on",
  },
  outputDir: "./output",
  reporter: [["list"]],
});
