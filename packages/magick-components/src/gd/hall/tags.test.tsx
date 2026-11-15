import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { DEFAULT_HALL_ART } from "./art/index.ts";
import type { HallStrictNode } from "./nodes.ts";
import * as Hall from "./tags.ts";
import type { HallNode } from "./types.ts";
import { validateHall } from "./validate.ts";
import { HALL_TAGS } from "./vocabulary.ts";
import { HALL_TAG, hallTagOf } from "./walk.ts";

// The tags entry (plan 084, stage 2): one tag per strict node type but
// the root, typed by the node's attributes, read by the walk. The type
// assertions are checked by the package's tsc, as in nodes.test.ts.

/** The tags, by name, without the entry's functions. */
const TAGS = Object.entries(Hall).filter(
  ([name]) => !/^(?:defineHallItem|defineHallTag|hallFromTags)$/.test(name),
);

/** A root the walk reads, as `GdHall` is from its own commit on. */
const Root = Object.defineProperty(
  (_props: { children?: Hall.HallChildren }): null => null,
  HALL_TAG,
  { value: "gdHall" },
);

const used = (node: HallNode, into = new Set<string>()) => {
  into.add(node.type);
  for (const child of node.children ?? []) used(child, into);
  return into;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the tags", () => {
  it("are one per strict node type but the root, named after it", () => {
    const types = TAGS.map(([name, tag]) => {
      expect(hallTagOf(tag), name).toBe(
        name.charAt(0).toLowerCase() + name.slice(1),
      );
      expect((tag as { displayName: string }).displayName).toBe(`Hall.${name}`);
      return hallTagOf(tag);
    });
    const strict = [
      ...new Set([
        ...HALL_TAGS.keys(),
        ...[...DEFAULT_HALL_ART.keys()].filter((key) => !key.includes(":")),
      ]),
    ].filter((type) => type !== "gdHall");
    expect(types.sort()).toEqual(strict.sort());
    expect(types).toHaveLength(25);
    expectTypeOf<(typeof types)[number]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Exclude<HallStrictNode["type"], "gdHall">>().toEqualTypeOf<
      | "dais"
      | "banners"
      | "floor"
      | "caption"
      | "door"
      | "officer"
      | "lamen"
      | "marker"
      | "altar"
      | "platform"
      | "throne"
      | "board"
      | "pillar"
      | "banner"
      | "veil"
      | "shewbread"
      | "candlestick"
      | "hebrewLetter"
      | "item"
      | "tarotKey"
      | "card"
      | "tablet"
      | "kamea"
      | "seal"
      | "label"
    >();
  });

  it("write a hall with every tag, which validates clean", () => {
    const roles = ["keryx", "stolistes"] as const;
    const { hall, diagnostics } = Hall.hallFromTags(
      <Root>
        <Hall.Banners side="east">
          <Hall.HebrewLetter letter="shin" x={3} />
        </Hall.Banners>
        <Hall.Dais spread="even">
          <Hall.Officer role="hierophant" label="" />
          <Hall.Veil x={8} y={-0.3} />
        </Hall.Dais>
        <Hall.Floor>
          <Hall.Pillar kind="black" x={4} y={3} glow />
          <Hall.Banner kind="east" x={8} y={2} />
          <Hall.Altar at="center">
            <Hall.Item kind="cross" form="calvary" fill="gray" />
            <Hall.Item kind="lamp" light="white" x={0.5} />
            <Hall.Item kind="cup" x={-0.5} />
          </Hall.Altar>
          <Hall.Platform x={8} y={14} w={4} h={3}>
            <Hall.Officer role="hiereus" grade="portal">
              <Hall.Label text="West" />
            </Hall.Officer>
          </Hall.Platform>
          <Hall.Throne x={13} y={5} />
          <Hall.Lamen role="keryx" x={3} y={10} />
          <Hall.TarotKey n={0} x={2} y={2} />
          <Hall.Tablet element="air" version="dee" x={6} y={6} />
          <Hall.Card kind="pan" x={1.2} y={5} />
          <Hall.Kamea planet="saturn" x={12} y={10} />
          <Hall.Seal planet="moon" x={14} y={10} />
          <Hall.Shewbread x={2} y={8} />
          <Hall.Candlestick x={14} y={8} />
          <Hall.Board kind="flamingSword" x={2} y={14} />
          <Hall.Board w={2} h={1} x={14} y={14} />
          <Hall.Marker text="Candidate" x={8} y={11} />
          {roles.map((role, index) => (
            <Hall.Officer key={role} role={role} x={6 + index} y={12} />
          ))}
          <Hall.Label text="Floor" at="south" y={-1} />
          <Hall.Door side="north" y={8} />
        </Hall.Floor>
        <Hall.Door x={8} />
        <Hall.Caption text="Every tag" />
      </Root>,
    );
    expect(diagnostics).toEqual([]);
    expect([...used(hall)].sort()).toEqual(
      ["gdHall", ...TAGS.map(([, tag]) => hallTagOf(tag) ?? "")].sort(),
    );
    expect(validateHall(hall, { art: DEFAULT_HALL_ART })).toEqual([]);
  });

  it("type their props by the node's attributes", () => {
    expectTypeOf<Hall.PillarProps>().toExtend<{
      kind?: "black" | "white";
      glow?: boolean;
    }>();
    // @ts-expect-error a role the vocabulary does not know
    <Hall.Officer role="hegemen" />;
    // @ts-expect-error an officer needs its role
    <Hall.Officer x={3} />;
    // @ts-expect-error a cup takes no cross's form
    <Hall.Item kind="cup" form="calvary" />;
    // @ts-expect-error the old spelling is the readers', not the types'
    <Hall.Altar at="centre" />;
    // @ts-expect-error a caption needs its text
    <Hall.Caption />;
  });

  it("take no text or numbers as children (R6)", () => {
    // @ts-expect-error a caption's text is a prop
    <Hall.Caption text="a">Neophyte Temple</Hall.Caption>;
    // @ts-expect-error text has no place on the floor
    <Hall.Floor>loose text</Hall.Floor>;
    // @ts-expect-error nor a number
    <Hall.Floor>{7}</Hall.Floor>;
    // @ts-expect-error a label holds nothing, not even a tag
    <Hall.Label text="a">{<Hall.Label text="b" />}</Hall.Label>;
    const show = false as boolean;
    <Hall.Floor>
      {show && <Hall.Pillar />}
      {null}
      {undefined}
      {[<Hall.Pillar key="a" />, [<Hall.Pillar key="b" />]]}
      <>
        <Hall.Pillar />
      </>
    </Hall.Floor>;
    expect(true).toBe(true);
  });

  it("render nothing, and warn once per tag when rendered in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(renderToStaticMarkup(<Hall.Throne />)).toBe("");
    expect(renderToStaticMarkup(<Hall.Throne x={2} />)).toBe("");
    expect(renderToStaticMarkup(<Hall.Shewbread />)).toBe("");
    expect(warn.mock.calls).toEqual([
      [
        "Hall.Throne rendered outside GdHall: tags are read by GdHall, not rendered; across a client boundary, pass hallFromTags(…).hall instead",
      ],
      [
        "Hall.Shewbread rendered outside GdHall: tags are read by GdHall, not rendered; across a client boundary, pass hallFromTags(…).hall instead",
      ],
    ]);
  });

  it("stay silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(renderToStaticMarkup(<Hall.Candlestick />)).toBe("");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("defineHallTag", () => {
  const SerpentTree = Hall.defineHallTag<Hall.HallPlaced & { coils?: number }>(
    "serpentTree",
  );

  it("makes a tag for a node type of your own art's", () => {
    expect(hallTagOf(SerpentTree)).toBe("serpentTree");
    expect(SerpentTree.displayName).toBe("SerpentTree");
    expect(
      Hall.hallFromTags(
        <Root>
          <Hall.Floor>
            <SerpentTree coils={3} at="center">
              <Hall.Label text="Serpent" />
            </SerpentTree>
          </Hall.Floor>
        </Root>,
      ).hall.children,
    ).toEqual([
      {
        type: "floor",
        children: [
          {
            type: "serpentTree",
            coils: 3,
            at: "center",
            children: [{ type: "label", text: "Serpent" }],
          },
        ],
      },
    ]);
    // @ts-expect-error its props are what it was given
    <SerpentTree coils="three" />;
  });

  it("places by default", () => {
    const Ring = Hall.defineHallTag("ring");
    expectTypeOf<Parameters<typeof Ring>[0]>().toExtend<Hall.HallPlaced>();
    <Ring at="north" x={1} />;
  });
});

describe("defineHallItem", () => {
  const Sistrum = Hall.defineHallItem<{ metal?: "gold" | "silver" }>("sistrum");

  it("makes an item tag for a kind of your own art's (R3)", () => {
    expect(hallTagOf(Sistrum)).toBe("item");
    expect(Sistrum.displayName).toBe("Sistrum");
    expect(
      Hall.hallFromTags(
        <Root>
          <Hall.Floor>
            <Sistrum at="east" metal="gold" />
          </Hall.Floor>
        </Root>,
      ).hall.children?.[0].children,
    ).toStrictEqual([
      { type: "item", kind: "sistrum", at: "east", metal: "gold" },
    ]);
  });

  it("keeps its kind whatever the props say", () => {
    const props = { kind: "cup", x: 2 } as unknown as Parameters<
      typeof Sistrum
    >[0];
    expect(
      Hall.hallFromTags(
        <Root>
          <Sistrum {...props} />
        </Root>,
      ).hall.children,
    ).toStrictEqual([{ type: "item", kind: "sistrum", x: 2 }]);
    // @ts-expect-error nor may they try
    <Sistrum kind="cup" />;
    // @ts-expect-error its props are what it was given
    <Sistrum metal="brass" />;
  });
});

describe("the tags module", () => {
  // `import * as Hall` must not load the renderer: at run time the
  // module reaches React and the walk alone, which reaches React alone.
  const file = path.resolve("packages/magick-components/src/gd/hall/tags.ts");

  /** The modules a file imports at run time: type-only imports aside. */
  function runtimeImports(source: string): string[] {
    const parsed = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest);
    return parsed.statements.flatMap((statement) => {
      if (
        (ts.isImportDeclaration(statement) &&
          !statement.importClause?.isTypeOnly) ||
        (ts.isExportDeclaration(statement) &&
          !statement.isTypeOnly &&
          statement.moduleSpecifier)
      ) {
        if (
          ts.isExportDeclaration(statement) &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.every((element) => element.isTypeOnly)
        )
          return [];
        return [(statement.moduleSpecifier as ts.StringLiteral).text];
      }
      return [];
    });
  }

  it("reaches React and the walk alone", () => {
    const reached = new Set<string>();
    const visit = (from: string) => {
      for (const name of runtimeImports(readFileSync(from, "utf8"))) {
        if (!name.startsWith(".")) {
          reached.add(name);
          continue;
        }
        const next = path.resolve(path.dirname(from), name);
        const key = path.relative(path.dirname(file), next);
        if (reached.has(key)) continue;
        reached.add(key);
        visit(next);
      }
    };
    visit(file);
    expect([...reached].sort()).toEqual(["react", "walk.ts"]);
  });
});
