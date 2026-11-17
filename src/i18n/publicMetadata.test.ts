import { expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { pageMetadata } from "@/seo/metadata";
import { PUBLIC_PAGES } from "@/seo/pages";
import {
  indexableLocalizedPaths,
  publicAlternates,
  publicEdition,
} from "./publications";
import {
  localizedPageMetadata,
  PUBLIC_METADATA_MESSAGES,
} from "./publicMetadata";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
it("keeps Hebrew usable while withholding indexing and search discovery until final launch", () => {
  for (const path of ["/", "/about", "/books"] as const) {
    expect(PUBLIC_METADATA_MESSAGES[path].title).toBe(PUBLIC_PAGES[path].title);
    expect(PUBLIC_METADATA_MESSAGES[path].description).toBe(
      PUBLIC_PAGES[path].description,
    );
    const translated = localizedPageMetadata(path, "he");
    expect(translated.alternates).toEqual({
      canonical: publicEdition(path, "he"),
    });
    expect(translated.description).toMatch(/[א-ת]/);
    expect(translated.robots).toEqual({ index: false, follow: true });
    expect(pageMetadata(path).robots).toBeUndefined();
    expect(publicAlternates(path)).toBeUndefined();
    expect(publicAlternates(publicEdition(path, "he")!)).toBeUndefined();
  }
  expect(indexableLocalizedPaths()).toEqual([]);
  expect(
    sitemap().some((entry) =>
      /^\/he(?:\/|$)/.test(new URL(entry.url).pathname),
    ),
  ).toBe(false);
  expect(sitemap().some((entry) => entry.alternates)).toBe(false);
  expect(pageMetadata("/about").alternates).toEqual({ canonical: "/about" });
});
it("rejects English or unsupported aliases under a language segment", () => {
  expect(() => localizedPageMetadata("/about", "en")).toThrow("NOT_FOUND");
  expect(() => localizedPageMetadata("/about", "fr")).toThrow("NOT_FOUND");
});
