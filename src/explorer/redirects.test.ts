import { compile, match } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import nextConfig from "../../next.config";
import { EXPLORER_COMPONENTS, explorerComponent } from "./components";
import { COMPONENT_REDIRECTS } from "./redirects";

/** Where the built config sends a path, or null when nothing matches. */
async function redirected(path: string) {
  const config = await nextConfig("phase-component-redirects-test");
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

const slug = (path: string) => path.split("/").at(-1) as string;

describe("the explorer's renamed pages", () => {
  it("send Mercury's old page to MercuryWidget's for good", async () => {
    expect(await redirected("/open-source/components/mercury")).toEqual({
      to: "/open-source/components/mercury-widget",
      permanent: true,
    });
  });

  it("each leave a page that is gone for one that is there", () => {
    for (const { source, destination } of COMPONENT_REDIRECTS) {
      expect(explorerComponent(slug(source)), source).toBeUndefined();
      expect(explorerComponent(slug(destination))?.path).toBe(destination);
    }
  });

  it("leave every page of a component alone", async () => {
    for (const component of EXPLORER_COMPONENTS)
      expect(await redirected(component.path), component.path).toBeNull();
  });
});
