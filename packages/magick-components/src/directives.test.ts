import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `"use client"` only where a module cannot run on the server (plan 080,
 * decision 7). TreeOfLife and GdHall are built to be Server Components, and
 * the server image renderer draws TreeOfLife and RoseSigilImage, where a
 * directive would make them client references. Every export of a client
 * module becomes a client reference too, so one exports only its
 * component (and types, which are erased).
 */
const root = path.resolve("packages/magick-components/src");
const CLIENT_MODULES = [
  "astrology/Mercury.tsx",
  "astrology/Moon.tsx",
  "gd/RoseSigil.tsx",
];

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });
}

const relative = (file: string) =>
  path.relative(root, file).split(path.sep).join("/");

describe("client directives", () => {
  const files = sources(root);
  const client = files.filter((file) =>
    readFileSync(file, "utf8").startsWith('"use client";'),
  );

  it("marks exactly the modules that need the browser", () => {
    expect(client.map(relative).sort()).toEqual(CLIENT_MODULES);
  });

  it("puts the directive nowhere but a module's first line", () => {
    const misplaced = files.filter((file) =>
      /^(?!^)\s*"use client";/m.test(
        readFileSync(file, "utf8").split("\n").slice(1).join("\n"),
      ),
    );
    expect(misplaced.map(relative)).toEqual([]);
  });

  it("has each client module export only its component and types", () => {
    const extra = client.flatMap((file) =>
      [
        ...readFileSync(file, "utf8").matchAll(
          /^export (?!default |interface |type )(.*)$/gm,
        ),
      ].map((match) => `${relative(file)}: ${match[1]}`),
    );
    expect(extra).toEqual([]);
  });
});
