import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" stops a server module from reaching the browser bundle; unit tests run on the server anyway.
      "server-only": path.resolve(__dirname, "src/lib/server-only-stub.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts", "eval/**/*.test.ts"], passWithNoTests: true },
});
