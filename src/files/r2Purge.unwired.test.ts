// Loom's S3 adapter has no deleteObject unless DeleteObjectCommand is wired;
// the purger must fail loudly rather than count a skipped delete as done.
import { describe, expect, it, vi } from "vitest";
import { createRitualObjectPurger, type RitualPurgeClient } from "./r2Purge";

vi.mock("server-only", () => ({}));
vi.mock("@gadicc/loom/files/s3", () => ({
  createS3FileStorage: () => ({}),
}));

const bucket = "private-ritual-files";
const environment = {
  FILES_STORAGE_PROVIDER: "cloudflare-r2",
  FILES_S3_REGION: "auto",
  FILES_S3_FORCE_PATH_STYLE: "true",
  FILES_S3_ENDPOINT:
    "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
  FILES_S3_BUCKET: bucket,
  FILES_S3_ACCESS_KEY_ID: "EXAMPLE",
  FILES_S3_SECRET_ACCESS_KEY: "synthetic-only",
};

describe("the ritual object purger without a wired delete", () => {
  it("throws instead of passing a skipped delete as success", async () => {
    const client: RitualPurgeClient = { send: vi.fn(), destroy: vi.fn() };
    const purger = createRitualObjectPurger(environment, { client });
    await expect(
      purger.deleteObject(bucket, "ritual-files/f/object"),
    ).rejects.toThrow("Object deletion is not wired");
    expect(client.send).not.toHaveBeenCalled();
  });
});
