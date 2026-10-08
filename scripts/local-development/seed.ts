import "server-only";
import { readFileSync } from "node:fs";
import {
  seedLocalDevelopmentFixtures,
  seedLocalDevelopmentRitualFixture,
} from "./fixtures";
import { verifyLocalDevelopmentDatabase } from "./verify-db";

async function main() {
  await verifyLocalDevelopmentDatabase(process.env);
  const { db } = await import("../../src/db/neonFull");
  await db.transaction((tx) => seedLocalDevelopmentFixtures(tx));
  console.log("LOCAL_DEVELOPMENT_CREATOR_READER_SEEDED");
  const { ritualId } = await seedLocalDevelopmentRitualFixture(
    db,
    readFileSync(new URL("../../src/doc/0=0.pug", import.meta.url), "utf8"),
  );
  console.log(`LOCAL_DEVELOPMENT_RITUAL_FIXTURE_SEEDED /doc/${ritualId}/edit`);
}

main()
  .catch(() => {
    console.error("LOCAL_DEVELOPMENT_SEED_FAILED");
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
