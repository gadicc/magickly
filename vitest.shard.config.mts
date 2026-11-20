import { defineConfig } from "vitest/config";
import config from "./vitest.config.mts";

// A shard sees only part of each file's coverage. The merge job uses the base
// config to enforce the original per-file thresholds on the combined report.
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    // Under coverage and a shard's parallel files, tests run at a third to a
    // fifth of local speed; about twenty sat between 4s and 5.2s against the
    // 5s default, and a different one timed out each run (runs 44694366508
    // and 44700532649). Local runs keep 5s, so a slowing test still shows.
    testTimeout: 15_000,
    coverage: {
      ...config.test?.coverage,
      thresholds: undefined,
      reporter: [],
    },
  },
});
