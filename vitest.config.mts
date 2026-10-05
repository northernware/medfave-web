import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for rules in lib/ that need no database: `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
});
