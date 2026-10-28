import { compile, match } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GD_HALLS } from "@/render/contracts/gdHall";
import nextConfig from "../../next.config";
import { hallFiles, hallPath } from "./halls";

/** Where the built config sends a path, or null when nothing matches. */
async function redirected(path: string) {
  const config = await nextConfig("phase-hall-redirects-test");
  for (const rule of (await config.redirects?.()) ?? []) {
    const found = match(rule.source)(path);
    if (found === false) continue;
    return {
      to: compile(rule.destination)(found.params as Record<string, string>),
      permanent: rule.permanent,
    };
  }
  return null;
}

describe("the temple halls' old URLs (plan 062's amendment)", () => {
  it("send the editor, each page and each file to /gd/halls for good", async () => {
    expect(await redirected("/gd/hall")).toEqual({
      to: "/gd/halls/editor",
      permanent: true,
    });
    for (const hall of GD_HALLS) {
      const page = hallPath(hall);
      expect(await redirected(`/gd/hall/${hall.slug}`)).toEqual({
        to: page,
        permanent: true,
      });
      for (const file of Object.values(hallFiles(hall)))
        expect(await redirected(`/gd/hall/${hall.slug}/${file.name}`)).toEqual({
          to: file.path,
          permanent: true,
        });
    }
  });

  it("leaves the new URLs alone", async () => {
    for (const path of ["/gd/halls", "/gd/halls/editor", "/gd/halls/neophyte"])
      expect(await redirected(path)).toBeNull();
  });
});
