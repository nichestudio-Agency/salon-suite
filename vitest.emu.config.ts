import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["**/*.emu.test.ts", "**/*.emu.test.tsx"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
