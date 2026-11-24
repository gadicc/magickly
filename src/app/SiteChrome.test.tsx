// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tapShare } from "../../tests/pageShare";
import { usePageShare } from "./pageShare";
import SiteChrome from "./SiteChrome";

// The chrome's own pieces, down to the app bar's Share.
vi.mock("./clientProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./MyAppBar", async () => {
  const { default: ShareButton } = await import("./ShareButton");
  return { default: () => <ShareButton /> };
});
vi.mock("./SiteFooter", () => ({ default: () => null }));
vi.mock("@/analytics/VercelInsights", () => ({ default: () => null }));

afterEach(cleanup);

function Page() {
  usePageShare({ url: () => "/gd/sigils?text=abc", personal: true });
  return <p>a page</p>;
}

describe("SiteChrome", () => {
  it("lets the app bar's Share reach a link the page registers", async () => {
    render(
      <SiteChrome>
        <Page />
      </SiteChrome>,
    );
    expect(await tapShare()).toEqual({
      copied: [`${window.location.origin}/gd/sigils?text=abc`],
      said: "Copied link to this page. It includes what you entered here.",
    });
  });
});
