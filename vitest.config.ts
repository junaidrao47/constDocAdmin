import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsxInject: 'import React from "react"',
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Vitest owns the unit/component tests under src/; the Playwright e2e specs under
    // e2e/ are run by `npm run e2e`, never by vitest.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});