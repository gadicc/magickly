/**
 * `pnpm data:check`: [the integrity checks](./integrity.ts) on the command
 * line, printing everything that is wrong and then exiting non-zero if
 * anything was, so that one run says the whole of it. `pnpm build` and
 * `pnpm check:turbopack` run it after `data:build`, so a build stops before
 * Next reads data the graph disagrees with; `integrity.test.ts` is the same
 * list in CI.
 */
import { coverage } from "./coverage";
import { checkIntegrity } from "./integrity";
import { tables } from "./tables";

const failures = checkIntegrity();
for (const { check, where, detail } of failures)
  console.error(`${check}: ${where} — ${detail}`);

const counted = `${Object.keys(tables).length} tables and the dictionary`;

// What the graph does not check, said out loud. A file can be compiled into
// data/dist and served while no check ever opens it, and a run that reports
// "nothing wrong" should not be read as covering the whole of data/.
const { uncovered } = coverage();
if (uncovered.length) {
  console.log(`data: ${uncovered.length} sources the graph does not check:`);
  for (const { file, by } of uncovered)
    console.log(`  ${file} — checked by ${by}`);
}

if (failures.length) {
  console.error(`data: ${failures.length} problems in ${counted}`);
  process.exit(1);
}
console.log(`data: nothing wrong in ${counted}`);
