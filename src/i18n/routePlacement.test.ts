import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routeInventory } from "../../scripts/i18n/inventory";
import {
  documentRootForPath,
  pageSourceForRoute,
  ROUTE_PLACEMENT,
} from "./routePlacement";

describe("planned document boundaries", () => {
  it("assigns every app page once and has no stale route entries", async () => {
    const inventory = await routeInventory(
      fileURLToPath(new URL("../app", import.meta.url)),
    );
    const routes = inventory.map((row) => row.route);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.toSorted()).toEqual(Object.keys(ROUTE_PLACEMENT).toSorted());
    for (const row of inventory)
      expect(row.source).toBe(pageSourceForRoute(row.route));
  });

  it.each([
    ["/about", "public"],
    ["/gd/rituals", "public"],
    ["/books/la-science-cabalistique/texte-integral", "public"],
    ["/gd/components", "public"],
    ["/doc/neophyte", "public"],
    ["/doc/unknown", "reader"],
    ["/doc/unknown/edit", "private"],
    ["/doc/unknown/edit/semantic", "private"],
    ["/offline/ritual", "offline"],
    ["/chat/research", "research"],
    ["/temples/", "private"],
    ["/temples/admin/example/membership/member", "private"],
    ["/api/auth/session", null],
    ["/he/temples", null],
    ["/he/chat/research", null],
    ["/unknown", null],
    ["//about", null],
    ["/about?secret=example", null],
    ["/about#anchor", null],
    ["/about\\extra", null],
  ] as const)("%s belongs to %s", (pathname, expected) => {
    expect(documentRootForPath(pathname)).toBe(expected);
  });
});
