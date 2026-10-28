import { readFileSync, writeFileSync } from "node:fs";
import { hallPreset } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { gdHall, gdHallShortName } from "@/render/contracts/gdHall";
import { hallPath } from "@/seo/halls";
import { gdHallPug } from "./gdHallPug";
import { prepare } from "./prepare";

/**
 * The built-in rituals draw the presets (plan 061, stage I): each hall in
 * a doc is a copy of its preset's Pug, never a reference to it, followed
 * in its note by a link to the hall's page. When a preset changes, run
 * this file with BUILT_IN_HALLS=write to rewrite the copies.
 */
const DOCS: Record<string, string[]> = {
  "0=0": ["neophyte"],
  "1=10": ["zelator-1", "zelator-2"],
  "2=9": ["theoricus-1", "theoricus-2"],
};

const file = (name: string) => new URL(`./${name}.pug`, import.meta.url);

/** The link under a hall: its short name and what its page holds. */
const linkText = (slug: string) =>
  `${gdHallShortName(gdHall(slug) as never)}: stations, sources and downloads`;

/** The preset's Pug, at the hall's indent, as the doc should hold it. */
function expected(slug: string, indent: string): string[] {
  const preset = hallPreset((gdHall(slug) as { preset: string }).preset);
  if (!preset) throw new Error(`No preset for ${slug}`);
  return gdHallPug(preset.hall)
    .trimEnd()
    .split("\n")
    .map((line) => indent + line);
}

/**
 * Each hall's block in a doc: the `gdHall` line and the lines indented
 * under it, and the slug its link names (the line after the block).
 */
function hallBlocks(lines: string[]) {
  const blocks: { start: number; end: number; indent: string; slug: string }[] =
    [];
  lines.forEach((line, start) => {
    const indent = /^(\s*)gdHall\b/.exec(line)?.[1];
    if (indent === undefined) return;
    let end = start + 1;
    while (end < lines.length && lines[end].startsWith(`${indent} `)) end++;
    const slug = new RegExp(
      `^${indent}a\\(href="/gd/halls/([a-z0-9-]+)"\\)`,
    ).exec(lines[end] ?? "")?.[1];
    if (!slug) throw new Error(`Line ${end + 1}: no hall link after the hall`);
    blocks.push({ start, end, indent, slug });
  });
  return blocks;
}

describe("the built-in rituals' halls", () => {
  it.each(Object.entries(DOCS))(
    "%s draws its presets, copied",
    (name, slugs) => {
      const source = readFileSync(file(name), "utf8");
      const lines = source.split("\n");
      const blocks = hallBlocks(lines);
      expect(blocks.map((block) => block.slug)).toEqual(slugs);
      if (process.env.BUILT_IN_HALLS === "write") {
        for (const block of [...blocks].reverse())
          lines.splice(
            block.start,
            block.end - block.start,
            ...expected(block.slug, block.indent),
          );
        writeFileSync(file(name), lines.join("\n"));
        return;
      }
      for (const block of blocks)
        expect(
          lines.slice(block.start, block.end),
          `${name}.pug's ${block.slug} hall differs from its preset: run this test with BUILT_IN_HALLS=write`,
        ).toEqual(expected(block.slug, block.indent));
      // No old drawing stands in for a hall any more.
      expect(source).not.toMatch(
        /img\(src="\/pics\/(neophyte|zelator|theoricus)/,
      );
    },
  );

  it.each(Object.entries(DOCS))(
    "%s links each hall's page from its note",
    (name, slugs) => {
      const tree = prepare(readFileSync(file(name), "utf8")) as {
        children?: unknown[];
      };
      const found: string[] = [];
      const walk = (node: unknown) => {
        const row = node as { type?: string; children?: unknown[] };
        const children = row.children ?? [];
        children.forEach((child, i) => {
          if ((child as { type?: string }).type !== "gdHall")
            return walk(child);
          // A hall stands in a note, followed by its link.
          expect(row.type).toBe("note");
          const link = children[i + 1] as {
            type: string;
            href: string;
            children: { value: string }[];
          };
          const slug = slugs[found.length];
          expect(link).toMatchObject({
            type: "a",
            href: hallPath(gdHall(slug) as never),
          });
          expect(link.children.map((text) => text.value).join("")).toBe(
            linkText(slug),
          );
          found.push(slug);
        });
      };
      walk(tree);
      expect(found).toEqual(slugs);
    },
  );
});
