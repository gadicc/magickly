import "server-only";
import { readFileSync } from "node:fs";
import { verifyLocalDevelopmentDatabase } from "../local-development/verify-db";
import { seedDocsScreenshotFixtures } from "./fixtures";

async function main() {
  await verifyLocalDevelopmentDatabase(process.env);
  const { db } = await import("../../src/db/neonFull");
  const seeded = await seedDocsScreenshotFixtures(
    db,
    readFileSync(new URL("../../src/doc/0=0.pug", import.meta.url), "utf8"),
  );
  console.log(`DOCS_SCREENSHOTS_SEEDED ${JSON.stringify(seeded)}`);
}

main()
  .catch((error) => {
    console.error("DOCS_SCREENSHOTS_SEED_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = (
      globalThis as typeof globalThis & {
        __loomNeonFullSql?: {
          end(options?: { timeout?: number }): Promise<void>;
        };
      }
    ).__loomNeonFullSql;
    await client?.end({ timeout: 1 }).catch(() => {});
  });
