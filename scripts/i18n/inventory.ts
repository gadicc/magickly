import { readdir } from "node:fs/promises";
import path from "node:path";
import { ROUTE_PLACEMENT } from "../../src/i18n/routePlacement";

/** Every page and its planned document root; fail if a route is unclassified. */
export async function routeInventory(appDirectory: string) {
  async function walk(directory: string): Promise<string[]> {
    const children = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        children.map(async (entry) => {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) return walk(file);
          return /^page\.(tsx|jsx|ts|js)$/.test(entry.name) ? [file] : [];
        }),
      )
    ).flat();
  }
  return (await walk(appDirectory))
    .map((file) => {
      const segments = path
        .relative(appDirectory, path.dirname(file))
        .split(path.sep);
      const route = `/${segments.filter((segment) => segment && !/^\(.+\)$/.test(segment)).join("/")}`;
      const root = ROUTE_PLACEMENT[route as keyof typeof ROUTE_PLACEMENT];
      if (!root) throw new Error(`Page lacks a document-root policy: ${route}`);
      return { route, root, source: path.relative(appDirectory, file) };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}
