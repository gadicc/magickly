/** Explicit offline stdin entry; importing the pure compiler never starts this CLI. */

import { runOfflineSectionCases } from "./experiment.mts";
import { sectionCheck } from "./headings.mts";

if (import.meta.main) {
  try {
    const parts: Buffer[] = [];
    let bytes = 0;
    for await (const part of process.stdin) {
      bytes += part.length;
      sectionCheck(bytes <= 256 * 1024 * 1024);
      parts.push(Buffer.from(part));
    }
    const result = await runOfflineSectionCases(
      JSON.parse(Buffer.concat(parts).toString("utf8")),
    );
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch {
    process.stdout.write(
      JSON.stringify({
        status: "failed",
        message: "Offline section control unavailable",
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
