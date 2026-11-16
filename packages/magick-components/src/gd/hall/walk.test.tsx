import {
  createContext,
  createRef,
  Fragment,
  forwardRef,
  lazy,
  memo,
  type ReactNode,
  Suspense,
} from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { GdHallAttributes } from "./nodes.ts";
import type { HallNode } from "./types.ts";
import { HALL_TAG, hallFromTags, hallTagOf, ROOT_ATTRIBUTES } from "./walk.ts";

// The walk's contract is the marker, so these tests mark components of
// their own; the tags entry's tests hold its tags to the same marker.

type AnyProps = { children?: ReactNode; [prop: string]: unknown };

/** A component that stands for `type`, as a hall tag does. */
function marked(type: string, displayName: string) {
  const tag = (_props: AnyProps): null => null;
  Object.defineProperty(tag, HALL_TAG, { value: type });
  tag.displayName = displayName;
  return tag;
}

const Root = marked("gdHall", "GdHall");
const Floor = marked("floor", "Hall.Floor");
const Dais = marked("dais", "Hall.Dais");
const Caption = marked("caption", "Hall.Caption");
const Pillar = marked("pillar", "Hall.Pillar");
const Officer = marked("officer", "Hall.Officer");
const Altar = marked("altar", "Hall.Altar");
const Item = marked("item", "Hall.Item");
const Label = marked("label", "Hall.Label");
const SerpentTree = marked("serpentTree", "SerpentTree");

const pillars = () => (
  <>
    <Pillar kind="black" x={4} />
    <Pillar kind="white" x={12} />
  </>
);

/** Each diagnostic as `path: message`. */
const report = (element: Parameters<typeof hallFromTags>[0]) =>
  hallFromTags(element).diagnostics.map((diagnostic) => {
    expect(diagnostic.severity).toBe("error");
    return `[${diagnostic.path}] #${diagnostic.child}: ${diagnostic.message}`;
  });

describe("hallTagOf", () => {
  it("reads the marker, from any copy of the package", () => {
    expect(hallTagOf(Pillar)).toBe("pillar");
    const elsewhere = () => null;
    Object.defineProperty(elsewhere, Symbol.for("magick-components.hallTag"), {
      value: "veil",
    });
    expect(hallTagOf(elsewhere)).toBe("veil");
  });

  it("is undefined for anything unmarked", () => {
    for (const type of ["div", () => null, memo(Pillar), null, undefined, 3])
      expect(hallTagOf(type)).toBeUndefined();
  });
});

describe("the walk", () => {
  it("flattens Fragments, arrays and iterables, and skips holes", () => {
    const show = false as boolean;
    const roles = ["keryx", "stolistes"] as const;
    const { hall, diagnostics } = hallFromTags(
      <Root wall="gradient" dais={undefined}>
        {null}
        {show && <Caption text="no" />}
        <Floor>
          {undefined}
          {pillars()}
          {roles.map((role) => (
            <Officer key={role} role={role} label={undefined} />
          ))}
          <Fragment key="f">
            <>
              <Altar at="center">
                <Item kind="cup" />
              </Altar>
            </>
          </Fragment>
          {new Set([<Pillar key="v" kind="white" />])}
          <SerpentTree coils={3} />
        </Floor>
        {true}
        <Caption text="yes" />
      </Root>,
    );
    expect(diagnostics).toEqual([]);
    expect(hall).toStrictEqual({
      type: "gdHall",
      wall: "gradient",
      children: [
        {
          type: "floor",
          children: [
            { type: "pillar", kind: "black", x: 4 },
            { type: "pillar", kind: "white", x: 12 },
            { type: "officer", role: "keryx" },
            { type: "officer", role: "stolistes" },
            {
              type: "altar",
              at: "center",
              children: [{ type: "item", kind: "cup" }],
            },
            { type: "pillar", kind: "white" },
            { type: "serpentTree", coils: 3 },
          ],
        },
        { type: "caption", text: "yes" },
      ],
    } satisfies HallNode);
  });

  it("names each dropped child by its parent's path and its place", () => {
    const Wrapper = () => pillars();
    expect(
      report(
        <Root>
          <Floor>
            {null}
            <Pillar />
            <>
              {false}
              <Wrapper />
            </>
            {["loose", <div key="d" />]}
            <Altar>
              <Item kind="cup" />
              {7}
            </Altar>
          </Floor>
          {"after"}
        </Root>,
      ),
    ).toEqual([
      "[0] #3: gdHall > floor[0], child 3: Wrapper is not a hall tag; write it as a function and call it in braces: {wrapper()}",
      '[0] #4: gdHall > floor[0], child 4: the text "loose" is not drawn; text belongs in a prop such as text',
      "[0] #5: gdHall > floor[0], child 5: <div> is not a hall tag; a hall draws only tags",
      "[0,1] #1: gdHall > floor[0] > altar[1], child 1: the number 7 is not drawn; text belongs in a prop such as text",
      '[] #1: gdHall, child 1: the text "after" is not drawn; text belongs in a prop such as text',
    ]);
  });

  it("refuses every kind of child that is not a tag", () => {
    const Named = () => null;
    const anonymous = [() => null][0];
    const Forwarded = forwardRef<SVGGElement>(function Forwarded(_props, _ref) {
      return null;
    });
    const MemoTag = memo(Pillar);
    const MemoWrapper = memo(Named);
    const Lazy = lazy(async () => ({ default: Named }));
    const Context = createContext(0);
    // A client component as a Server Component sees it: a proxy that
    // throws when read for anything but the properties React's reads
    // (react-server-dom-webpack's deepProxyHandlers).
    const known = new Set<PropertyKey>([
      "displayName",
      "defaultProps",
      "_debugInfo",
      "toJSON",
      Symbol.toPrimitive,
      Symbol.toStringTag,
    ]);
    const client = new Proxy(() => null, {
      get(_target, name) {
        if (name === "$$typeof") return Symbol.for("react.client.reference");
        if (name === "name") return "";
        if (known.has(name)) return undefined;
        throw new Error(`Cannot access ${String(name)} on the server`);
      },
    });
    const Client = client as unknown as (props: AnyProps) => null;
    const Anonymous = anonymous as (props: AnyProps) => null;
    const children: unknown[] = [
      "text",
      12,
      <g key="g" />,
      <Named key="named" />,
      <Anonymous key="anonymous" />,
      <Forwarded key="forwarded" />,
      <MemoTag key="memoTag" />,
      <MemoWrapper key="memoWrapper" />,
      <Lazy key="lazy" />,
      <Root key="root">
        <Floor />
      </Root>,
      <Client key="client" />,
      <Suspense key="suspense">
        <Pillar />
      </Suspense>,
      <Context key="context" value={1} />,
      pillars,
      Promise.resolve(<Pillar />),
      { kind: "black" },
    ];
    const lines = report(
      <Root>
        <Floor>{children as ReactNode}</Floor>
      </Root>,
    ).map((line) => line.replace(/^\[0\] #\d+: gdHall > floor\[0\], /, ""));
    expect(lines).toEqual([
      'child 0: the text "text" is not drawn; text belongs in a prop such as text',
      "child 1: the number 12 is not drawn; text belongs in a prop such as text",
      "child 2: <g> is not a hall tag; a hall draws only tags",
      "child 3: Named is not a hall tag; write it as a function and call it in braces: {named()}",
      "child 4: an anonymous component is not a hall tag; write it as a function and call it in braces",
      "child 5: Forwarded is not a hall tag; write it as a function and call it in braces: {forwarded()}",
      "child 6: memo(Hall.Pillar) is not read as a hall tag; write the tag itself",
      "child 7: memo(Named) is not a hall tag; write it as a function and call it in braces: {named()}",
      "child 8: a lazy component is not a hall tag; import the tags themselves",
      "child 9: a GdHall inside a hall is not drawn; a hall has one root, so draw a second GdHall beside this one",
      "child 10: a client component is not a hall tag; a hall draws only tags",
      "child 11: a react.suspense element is not a hall tag",
      "child 12: a react.context element is not a hall tag",
      "child 13: a function (pillars) is not a hall tag; call it in braces",
      "child 14: a promise is not a hall tag; build the hall from data already loaded",
      "child 15: an object is not a hall tag",
    ]);
    expect(hallFromTags(<Root>{children as ReactNode}</Root>).hall).toEqual({
      type: "gdHall",
      children: [],
    });
  });

  it("never gives a dropped child a kept node's path", () => {
    const { hall, diagnostics } = hallFromTags(
      <Root>
        <Floor>
          <Pillar x={1} />
          {"text"}
          <Pillar x={99} />
        </Floor>
      </Root>,
    );
    expect(diagnostics.map(({ path, child }) => ({ path, child }))).toEqual([
      { path: [0], child: 1 },
    ]);
    // [0, 1] is the second pillar's, which the validator would name.
    expect(hall.children?.[0].children?.[1]).toEqual({
      type: "pillar",
      x: 99,
    });
  });

  it("reports text in a leaf and keeps the leaf", () => {
    const { hall, diagnostics } = hallFromTags(
      <Root>
        <Caption text="Neophyte">Neophyte Temple</Caption>
      </Root>,
    );
    expect(hall.children).toEqual([
      { type: "caption", text: "Neophyte", children: [] },
    ]);
    expect(diagnostics.map(({ path, child }) => ({ path, child }))).toEqual([
      { path: [0], child: 0 },
    ]);
  });

  it("keeps an empty list of children, as data's children: []", () => {
    expect(
      hallFromTags(
        <Root>
          <Pillar>{[]}</Pillar>
        </Root>,
      ).hall.children,
    ).toEqual([{ type: "pillar", children: [] }]);
  });

  it("keeps props that share a name with Object's own", () => {
    expect(
      hallFromTags(
        <Root>
          <SerpentTree constructor="a" toString="b" valueOf="c" />
        </Root>,
      ).hall.children,
    ).toEqual([
      { type: "serpentTree", constructor: "a", toString: "b", valueOf: "c" },
    ]);
  });

  it("drops key, ref, a type prop and undefined values", () => {
    const ref = createRef<SVGGElement>();
    expect(
      hallFromTags(
        <Root>
          <Label key="k" ref={ref} type="caption" text="a" width={undefined} />
        </Root>,
      ).hall.children,
    ).toEqual([{ type: "label", text: "a" }]);
  });
});

describe("hallFromTags", () => {
  it("reads the root's attributes alone, not what only draws", () => {
    const ref = createRef<SVGSVGElement>();
    expect(
      hallFromTags(
        <Root
          ref={ref}
          art={new Map()}
          fontBaseUrl="/fonts"
          className="hall"
          style={{ color: "red" }}
          width={600}
          height="20em"
          wall="plain"
          compass={false}
          dais={0}
          unknown="dropped"
        >
          <Dais />
        </Root>,
      ).hall,
    ).toStrictEqual({
      type: "gdHall",
      wall: "plain",
      compass: false,
      dais: 0,
      children: [{ type: "dais" }],
    });
  });

  it("knows every root attribute the types do", () => {
    expectTypeOf<(typeof ROOT_ATTRIBUTES)[number]>().toEqualTypeOf<
      keyof GdHallAttributes
    >();
  });

  it("returns the hall a GdHall is given", () => {
    const given: HallNode = { type: "gdHall", children: [{ type: "floor" }] };
    const result = hallFromTags(<Root hall={given} width={4} />);
    expect(result.hall).toBe(given);
    expect(result.diagnostics).toEqual([]);
  });

  it("gives an empty root without children", () => {
    expect(hallFromTags(<Root wall="gradient" />)).toEqual({
      hall: { type: "gdHall", wall: "gradient" },
      diagnostics: [],
    });
  });

  it("reads a hall of null as none, as GdHall does", () => {
    const nothing = null as unknown as HallNode;
    expect(
      hallFromTags(
        <Root hall={nothing} wall="plain">
          <Floor />
        </Root>,
      ),
    ).toEqual({
      hall: { type: "gdHall", wall: "plain", children: [{ type: "floor" }] },
      diagnostics: [],
    });
  });

  it("names a client component given as the root", () => {
    // A GdHall imported through a "use client" module, as a Server
    // Component sees it: a proxy that throws on anything React does not
    // read (react-server-dom-webpack's deepProxyHandlers).
    const client = new Proxy(() => null, {
      get(_target, name) {
        if (name === "$$typeof") return Symbol.for("react.client.reference");
        if (name === "name") return "";
        if (name === "displayName" || name === "defaultProps") return undefined;
        throw new Error(`Cannot access ${String(name)} on the server`);
      },
    });
    const ClientHall = client as unknown as (props: {
      children?: unknown;
    }) => null;
    const { hall, diagnostics } = hallFromTags(
      <ClientHall>
        <Floor />
      </ClientHall>,
    );
    expect(hall).toEqual({ type: "gdHall" });
    expect(diagnostics).toEqual([
      {
        path: [],
        severity: "error",
        message:
          'hallFromTags was given a client component: a GdHall imported through a "use client" module is one, and a Server Component cannot read it. Import GdHall from "magick-components/gd/hall" where you call hallFromTags',
      },
    ]);
  });

  it("refuses anything but a GdHall element", () => {
    const wrong = [
      [<Floor key="f" />, "a floor tag"],
      [<g key="g" />, "another element"],
      ["text", "something that is not an element"],
    ] as const;
    for (const [element, what] of wrong)
      expect(
        hallFromTags(element as Parameters<typeof hallFromTags>[0]),
      ).toEqual({
        hall: { type: "gdHall" },
        diagnostics: [
          {
            path: [],
            severity: "error",
            message: `hallFromTags takes a <GdHall> element and was given ${what}; wrap the tags in <GdHall>`,
          },
        ],
      });
  });
});
