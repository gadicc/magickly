import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { createRitualObjectPurger, type RitualPurgeClient } from "./r2Purge";

vi.mock("server-only", () => ({}));

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

function fake(reply: (command: unknown) => unknown = () => ({})) {
  const sent: { command: unknown; signal?: AbortSignal }[] = [];
  const client: RitualPurgeClient = {
    send: vi.fn(async (command, options) => {
      sent.push({ command, signal: options?.abortSignal });
      return reply(command);
    }),
    destroy: vi.fn(),
  };
  return { client, sent };
}

describe("the ritual object purger", () => {
  it("sends a real DeleteObjectCommand for the bucket and key", async () => {
    const { client, sent } = fake();
    const purger = createRitualObjectPurger(environment, { client });
    expect(purger.bucket).toBe(bucket);
    await purger.deleteObject(bucket, "ritual-bundles/b/asset");
    expect(sent).toHaveLength(1);
    expect(sent[0].command).toBeInstanceOf(DeleteObjectCommand);
    expect((sent[0].command as DeleteObjectCommand).input).toEqual({
      Bucket: bucket,
      Key: "ritual-bundles/b/asset",
    });
    expect(sent[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("counts a missing object as deleted, and rethrows anything else", async () => {
    const notFound = Object.assign(new Error("gone"), {
      name: "NoSuchKey",
      $metadata: { httpStatusCode: 404 },
    });
    let error: unknown = notFound;
    const { client } = fake(() => {
      throw error;
    });
    const purger = createRitualObjectPurger(environment, { client });
    await expect(purger.deleteObject(bucket, "k")).resolves.toBeUndefined();
    error = Object.assign(new Error("denied"), {
      name: "AccessDenied",
      $metadata: { httpStatusCode: 403 },
    });
    await expect(purger.deleteObject(bucket, "k")).rejects.toThrow("denied");
  });

  it("refuses another bucket, and keys it could not have written", async () => {
    const { client, sent } = fake();
    const purger = createRitualObjectPurger(environment, { client });
    await expect(
      purger.deleteObject("magickli-files-preview", "k"),
    ).rejects.toThrow("another bucket");
    await expect(purger.deleteObject(bucket, "")).rejects.toThrow("Invalid");
    await expect(purger.deleteObject(bucket, "/k")).rejects.toThrow("Invalid");
    await expect(purger.listPrefix("other", "ritual-files/f/")).rejects.toThrow(
      "another bucket",
    );
    for (const prefix of ["", "ritual-files/", "ritual-files/a/b/", "x/a/"])
      await expect(purger.listPrefix(bucket, prefix)).rejects.toThrow(
        "Invalid object prefix",
      );
    expect(sent).toEqual([]);
  });

  it("lists every page under a prefix", async () => {
    const pages = [
      {
        Contents: [{ Key: "ritual-files/f/a" }, { Key: "elsewhere" }, {}],
        IsTruncated: true,
        NextContinuationToken: "next",
      },
      { Contents: [{ Key: "ritual-files/f/b" }], IsTruncated: false },
      {},
    ];
    const { client, sent } = fake(() => pages.shift());
    const purger = createRitualObjectPurger(environment, { client });
    expect(await purger.listPrefix(bucket, "ritual-files/f/")).toEqual([
      "ritual-files/f/a",
      "ritual-files/f/b",
    ]);
    expect(sent.map(({ command }) => command)).toEqual([
      expect.any(ListObjectsV2Command),
      expect.any(ListObjectsV2Command),
    ]);
    expect((sent[1].command as ListObjectsV2Command).input).toEqual({
      Bucket: bucket,
      Prefix: "ritual-files/f/",
      ContinuationToken: "next",
    });
    expect(await purger.listPrefix(bucket, "ritual-bundles/b/")).toEqual([]);
    purger.destroy();
    expect(client.destroy).toHaveBeenCalled();
  });

  it("builds its own client from the environment", () => {
    const purger = createRitualObjectPurger(environment);
    expect(purger.bucket).toBe(bucket);
    purger.destroy();
    expect(() => createRitualObjectPurger({})).toThrow();
  });
});
