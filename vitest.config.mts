import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests live in the repo, which they did not used to.
 *
 * Every suite this project had — browser and unit alike — was written into a
 * temporary directory and lost the moment the machine it ran on went away, so
 * each session rebuilt them from nothing and none of them ever guarded a
 * commit. These run with `npm test`, from a clean clone, forever.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
