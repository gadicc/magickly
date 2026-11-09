// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useParams: () => {
    throw new Error("route params must not be read");
  },
}));

type Queued = [string, unknown?];
const queue = (name: "vaq" | "siq") =>
  (window as unknown as Record<string, Queued[] | undefined>)[name] ?? [];

async function render(pathname: string) {
  // A fresh module per test, so the private-page flag starts clear.
  vi.resetModules();
  navigation.pathname = pathname;
  const { default: VercelInsights } = await import("./VercelInsights");
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<VercelInsights />));
  return { root, VercelInsights };
}

afterEach(() => {
  for (const key of ["va", "vaq", "si", "siq", "vai", "vam", "sil"])
    delete (window as unknown as Record<string, unknown>)[key];
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("VercelInsights", () => {
  it("queues only the reduced path and route for an invite", async () => {
    await render("/temples/join/hermes/rose+cross");
    const views = queue("vaq").filter(([name]) => name === "pageview");
    expect(views).toEqual([
      ["pageview", { route: "/temples/*", path: "/temples/*" }],
    ]);
    expect(JSON.stringify(queue("vaq"))).not.toContain("rose");
    expect(
      document.querySelector("[data-route]")?.getAttribute("data-route"),
    ).toBe("/temples/*");
  });

  it("reports a public page by its path", async () => {
    await render("/kabbalah/sephirah/keter");
    expect(queue("vaq")).toContainEqual([
      "pageview",
      { route: "/kabbalah/sephirah/keter", path: "/kabbalah/sephirah/keter" },
    ]);
  });

  it("sends no vitals after a private page, even under a public URL", async () => {
    const { root, VercelInsights } = await render("/doc/abc");
    const beforeSend = queue("siq").find(
      ([name]) => name === "beforeSend",
    )?.[1] as (event: { type: "vital"; url: string }) => unknown;
    navigation.pathname = "/gd";
    await act(async () => root.render(<VercelInsights />));
    expect(
      beforeSend({ type: "vital", url: "https://magick.ly/gd" }),
    ).toBeNull();
  });

  it("sends vitals for public pages", async () => {
    await render("/gd");
    const beforeSend = queue("siq").find(
      ([name]) => name === "beforeSend",
    )?.[1] as (event: { type: "vital"; url: string }) => unknown;
    expect(
      beforeSend({ type: "vital", url: "https://magick.ly/gd?tab=1" }),
    ).toEqual({ type: "vital", url: "https://magick.ly/gd" });
    expect(
      beforeSend({ type: "vital", url: "https://magick.ly/doc/abc" }),
    ).toBeNull();
  });
});
