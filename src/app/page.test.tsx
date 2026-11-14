// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { footerSections } from "./siteNav";

const viewer = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/auth/viewer", () => ({ getCurrentSqlViewer: viewer.get }));
// Next imports SVGs as components; Vite as URLs.
vi.mock("@/goldendawn-logo-squished.svg", () => ({ default: () => null }));

const { default: Index } = await import("./page");

afterEach(() => {
  cleanup();
  viewer.get.mockReset();
});

const page = async (admin = false) => {
  viewer.get.mockResolvedValue(admin ? { admin: true } : null);
  return render(await Index());
};

/** The tiles' links, in order, before the text below them. */
const tileLinks = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLAnchorElement>("a")].filter(
    (link) => !link.closest("section"),
  );

describe("the home page", () => {
  it("orders its tiles by title", async () => {
    const { container } = await page();
    const titles = tileLinks(container).map((link) => link.textContent ?? "");
    expect(titles.length).toBeGreaterThan(5);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it("has an Open source tile with our own drawing", async () => {
    const { container } = await page();
    const tile = tileLinks(container).find(
      (link) => link.getAttribute("href") === "/open-source",
    );
    expect(tile?.textContent).toBe("Open source");
    const image = tile?.parentElement?.querySelector("img");
    expect(image?.getAttribute("src")).toMatch(/open-source\.webp/);
  });

  it("puts the Admin tile first for an admin only", async () => {
    await page(true);
    const first = tileLinks(document.body)[0];
    expect(first.getAttribute("href")).toBe("/admin");
    cleanup();
    await page(false);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("lists every footer section in its text", async () => {
    await page();
    const list = within(screen.getByRole("region")).getAllByRole("list")[0];
    const hrefs = within(list)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const section of footerSections()) {
      expect(hrefs).toContain(section.url);
    }
    expect(hrefs).toEqual(
      expect.arrayContaining(["/open-source/data", "/open-source/components"]),
    );
  });
});
