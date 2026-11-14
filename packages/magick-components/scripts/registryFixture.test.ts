import { describe, expect, it } from "vitest";
import { registryFixture } from "./registryFixture.mjs";

// Plan 080, stage G review, H1: a tarball kept for a release must have
// been checked against the registry's magick-data.
describe("the smoke test's registry fixture", () => {
  const base = {
    version: "0.1.0-rc.0",
    keepTarball: true,
    allowUnpublishedData: false,
    dataPublished: true,
  };

  it("runs whenever npm has the magick-data version", () => {
    expect(registryFixture(base)).toBe("run");
    expect(registryFixture({ ...base, version: "0.0.0" })).toBe("run");
    expect(registryFixture({ ...base, keepTarball: false })).toBe("run");
    expect(registryFixture({ ...base, allowUnpublishedData: true })).toBe(
      "run",
    );
  });

  it("fails a tarball kept for a release against a magick-data npm lacks", () => {
    expect(registryFixture({ ...base, dataPublished: false })).toBe("fail");
    expect(
      registryFixture({ ...base, version: "1.2.3", dataPublished: false }),
    ).toBe("fail");
  });

  it("skips it when allowed, or when nothing is kept for a release", () => {
    const missing = { ...base, dataPublished: false };
    // publish.yml's build leg, when the same run publishes magick-data;
    // ci.yml, whose tarball is only dry-run.
    expect(registryFixture({ ...missing, allowUnpublishedData: true })).toBe(
      "skip",
    );
    // The gate's and a developer's smoke, which keep nothing.
    expect(registryFixture({ ...missing, keepTarball: false })).toBe("skip");
    // 0.0.0 is never published.
    expect(registryFixture({ ...missing, version: "0.0.0" })).toBe("skip");
  });
});
