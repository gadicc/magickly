import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECK_VERSION } from "./check.ts";
import { PARTS_VERSION } from "./passage.ts";
import { readingStoreVersion } from "./store.ts";

/**
 * The store's version constants are bumped by hand (plan 081, "2D build
 * notes"): a stored reading is a check's verdict on parts laid out one
 * way, served for a day. These pins fail when either module's source
 * changes, so the change is looked at: bump the constant if a stored
 * reading could differ, then update the hash here (and the version, if
 * bumped). Formatting-only changes need the hash updated alone.
 */
const sha = (file: string) =>
  createHash("sha256")
    .update(readFileSync(new URL(file, import.meta.url)))
    .digest("hex");

describe("the store's version constants", () => {
  it("are pinned to check.ts's source", () => {
    expect(
      `${CHECK_VERSION} ${sha("./check.ts")}`,
      "check.ts changed: bump CHECK_VERSION if a verdict could change, then update this pin",
    ).toBe(
      "1 06da680f3f905eb82dd01855ee9a376d86344cc134b52270b8e41c06a92eefb9",
    );
  });

  it("are pinned to passage.ts's and numbering.ts's source", () => {
    expect(
      `${PARTS_VERSION} ${sha("./passage.ts")} ${sha("./numbering.ts")}`,
      "passage.ts or numbering.ts changed: bump PARTS_VERSION if the layout, parts or numbering could change, then update this pin",
    ).toBe(
      "2 4947732a18d58253177d14b9e75d011fd9353d7eea031d34178f03fea425283d 118b1990717a1774847dd492f7e0730a51fc140a4e977d5867b810fb1e7b9165",
    );
  });

  it("are both in the store's key", () => {
    expect(readingStoreVersion("v")).toBe(
      `v.c${CHECK_VERSION}.p${PARTS_VERSION}`,
    );
  });
});
