import { defineConfig } from "vitest/config";
import config from "./vitest.config.mts";

// A shard sees only part of each file's coverage. The merge job uses the base
// config to enforce the original per-file thresholds on the combined report.
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    coverage: {
      ...config.test?.coverage,
      thresholds: undefined,
      reporter: [],
    },
  },
});
