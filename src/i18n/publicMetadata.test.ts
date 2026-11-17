import { expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { pageMetadata } from "@/seo/metadata";
import { PUBLIC_PAGES } from "@/seo/pages";
import {
  localizedPageMetadata,
  PUBLIC_METADATA_MESSAGES,
} from "./publicMetadata";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
it("keeps reciprocal canonical language alternates on each published edition", () => {
  for (const path of ["/", "/about"] as const) {
    expect(PUBLIC_METADATA_MESSAGES[path].title).toBe(PUBLIC_PAGES[path].title);
    expect(PUBLIC_METADATA_MESSAGES[path].description).toBe(
      PUBLIC_PAGES[path].description,
    );
  }
  expect(pageMetadata("/about").alternates).toEqual({
    canonical: "/about",
    languages: { en: "/about", he: "/he/about", "x-default": "/about" },
  });
  expect(localizedPageMetadata("/about", "he").alternates).toEqual({
    canonical: "/he/about",
    languages: { en: "/about", he: "/he/about", "x-default": "/about" },
  });
  expect(localizedPageMetadata("/about", "he").description).toMatch(/[א-ת]/);
  const entries = sitemap().filter((row) => row.alternates);
  expect(entries.map((row) => row.url).sort()).toEqual(
    [
      "https://magick.ly",
      "https://magick.ly/about",
      "https://magick.ly/he",
      "https://magick.ly/he/about",
    ].sort(),
  );
  for (const entry of entries)
    expect(Object.keys(entry.alternates!.languages!)).toEqual([
      "en",
      "he",
      "x-default",
    ]);
});
it("never publishes English or unsupported aliases under a language segment", () => {
  expect(() => localizedPageMetadata("/about", "en")).toThrow("NOT_FOUND");
  expect(() => localizedPageMetadata("/about", "fr")).toThrow("NOT_FOUND");
});
