/** Execute actual rendered global-document scripts, including swallowed storage exceptions. */
import vm from "node:vm";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GlobalError from "./global-error";
import GlobalNotFound from "./global-not-found";

function execute(html: string) {
  let reads = 0;
  const classes = new Set<string>(),
    window = {
      location: { pathname: "/chat/research/unmatched-private-path" },
      matchMedia: () => ({ matches: true }),
    },
    context = {
      window,
      document: {
        documentElement: {
          classList: {
            contains: (name: string) => classes.has(name),
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name),
          },
        },
      },
    };
  for (const target of [window, context])
    for (const key of ["localStorage", "sessionStorage", "indexedDB"])
      Object.defineProperty(target, key, {
        get() {
          reads++;
          throw Error("Storage is forbidden on this document");
        },
      });
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, script] of scripts)
    vm.runInNewContext(script, context, { timeout: 1000 });
  return { reads, classes, scriptCount: scripts.length };
}
it.each([
  ["global unmatched research URL", () => <GlobalNotFound />],
  ["root error", () => <GlobalError reset={() => {}} />],
] as const)(
  "keeps %s scripts storage-free while following the device theme",
  (_name, component) => {
    const html = renderToStaticMarkup(component()),
      result = execute(html);
    expect(result.scriptCount).toBeGreaterThan(0);
    expect(result.reads).toBe(0);
    expect(result.classes.has("dark")).toBe(true);
    expect(html).not.toContain("<nav");
  },
);
it("detects MUI storage reads even when its initializer swallows the error", () => {
  const html = renderToStaticMarkup(
    <InitColorSchemeScript attribute="class" defaultMode="system" />,
  );
  expect(execute(html).reads).toBeGreaterThan(0);
});
