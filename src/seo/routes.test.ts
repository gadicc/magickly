import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageTrail } from "./Breadcrumbs";
import { PUBLIC_PAGES } from "./pages";
import { ENTITY_ROUTES, PRIVATE_ROUTES } from "./routeClasses";

const appDir = path.join(import.meta.dirname, "../app");

function pageRoutes(dir = appDir): { route: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageRoutes(file);
    if (entry.name !== "page.tsx") return [];
    const route = `/${path.relative(appDir, dir).split(path.sep).join("/")}`;
    return [
      {
        route: route === "/" ? route : route.replace(/\/$/, ""),
        source: readFileSync(file, "utf8"),
      },
    ];
  });
}

describe("page routes", () => {
  const routes = pageRoutes();

  it("classifies every page as public, entity or private", () => {
    const classifications = [
      ...Object.keys(PUBLIC_PAGES),
      ...ENTITY_ROUTES,
      ...PRIVATE_ROUTES,
    ];
    const known = new Set(classifications);
    expect(known.size).toBe(classifications.length);
    expect(
      routes.map(({ route }) => route).filter((r) => !known.has(r)),
    ).toEqual([]);
    expect(
      [...known].filter((r) => !routes.some(({ route }) => route === r)),
    ).toEqual([]);
  });

  it("gives each page the metadata its class requires", () => {
    for (const { route, source } of routes) {
      if (route in PUBLIC_PAGES)
        expect(source, route).toContain(
          `export const metadata = pageMetadata("${route}");`,
        );
      else if (ENTITY_ROUTES.includes(route))
        expect(source, route).toMatch(/export async function generateMetadata/);
      else
        expect(source, route).toMatch(
          /export const metadata = privateMetadata\("[^"]+"\);/,
        );
    }
  });

  it("gives each public page below a section its breadcrumb trail", () => {
    for (const { route, source } of routes) {
      if (!(route in PUBLIC_PAGES)) continue;
      const call = `<PageBreadcrumbs path="${route}" />`;
      if (pageTrail(route)) expect(source, route).toContain(call);
      else expect(source, route).not.toContain("PageBreadcrumbs");
    }
  });

  it("serves only the prerendered rows of each data route", () => {
    // Otherwise every unknown id renders and caches its own 404.
    for (const { route, source } of routes)
      if (source.includes("export function generateStaticParams"))
        expect(source, route).toContain("export const dynamicParams = false;");
  });

  it("keeps client components out of page files", () => {
    for (const { route, source } of routes)
      expect(source.startsWith('"use client"'), route).toBe(false);
  });
});
