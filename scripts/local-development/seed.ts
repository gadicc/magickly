import "server-only";
import { seedLocalDevelopmentFixtures } from "./fixtures";
import { verifyLocalDevelopmentDatabase } from "./verify-db";

async function main() {
  await verifyLocalDevelopmentDatabase(process.env);
  const { db } = await import("../../src/db/neonFull");
  await db.transaction((tx) => seedLocalDevelopmentFixtures(tx));
  console.log("LOCAL_DEVELOPMENT_CREATOR_READER_SEEDED");
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
