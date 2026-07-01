import { defineConfig } from "@playwright/test";

// CLAUDE.md rule 9: video recording at every project version completion.
export default defineConfig({
  testDir: "./tests",
  // System Design SDR-1: single-instance, vertically-scaled services for MVP —
  // parallel workers cause real resource-contention flakiness against the
  // live Docker Compose stack, not test bugs. Run sequentially.
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    video: "on",
  },
  outputDir: "./output",
  reporter: [["list"]],
});
