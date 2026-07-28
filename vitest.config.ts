import { defineConfig } from "vitest/config";

// Keeps vitest from walking up into the parent workspace's vite config.
export default defineConfig({
  test: {
    root: ".",
    include: ["src/**/*.test.ts"],
  },
});
