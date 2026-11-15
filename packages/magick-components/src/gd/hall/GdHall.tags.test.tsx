import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  GdHall,
  type GdHallProps,
  type GdHallRenderProps,
  type GdHallTagsProps,
} from "./GdHall.tsx";
import { neophyte } from "./presets/neophyte.ts";
import * as Hall from "./tags.ts";
import type { HallNode } from "./types.ts";
import { hallTagOf } from "./walk.ts";

// GdHall's children form (plan 084, stage 2, R1). Each preset drawn from
// tags against its data is in parity.test.tsx.

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

const pillars = () => (
  <>
    <Hall.Pillar kind="black" x={4} y={3} />
    <Hall.Pillar kind="white" x={12} y={3} />
  </>
);

describe("GdHall drawn from tags", () => {
  it("draws what the same hall as data draws, root attributes included", () => {
    const warn = quiet();
    const data: HallNode = {
      type: "gdHall",
      wall: "gradient",
      dais: 3,
      compass: false,
      margin: 1,
      children: [
        {
          type: "floor",
          children: [
            { type: "pillar", kind: "black", x: 4, y: 3 },
            { type: "pillar", kind: "white", x: 12, y: 3 },
          ],
        },
        { type: "caption", text: "Two pillars" },
      ],
    };
    const fromTags = renderToStaticMarkup(
      <GdHall wall="gradient" dais={3} compass={false} margin={1} width={300}>
        <Hall.Floor>{pillars()}</Hall.Floor>
        <Hall.Caption text="Two pillars" />
      </GdHall>,
    );
    expect(fromTags).toBe(
      renderToStaticMarkup(<GdHall hall={data} width={300} />),
    );
    expect(fromTags).toContain("linearGradient");
    expect(warn).not.toHaveBeenCalled();
  });

  it("carries the marker the walk reads as the root", () => {
    expect(hallTagOf(GdHall)).toBe("gdHall");
    expect(
      Hall.hallFromTags(
        <GdHall wall="plain" width={10}>
          <Hall.Floor />
        </GdHall>,
      ).hall,
    ).toStrictEqual({
      type: "gdHall",
      wall: "plain",
      children: [{ type: "floor" }],
    });
    expect(Hall.hallFromTags(<GdHall hall={neophyte.hall} />).hall).toBe(
      neophyte.hall,
    );
  });

  it("warns once in development about what the walk dropped", () => {
    const warn = quiet();
    const Pillars = () => pillars();
    const tree = (
      <GdHall>
        <Hall.Floor>
          <Pillars />
          <GdHall>
            <Hall.Floor />
          </GdHall>
        </Hall.Floor>
      </GdHall>
    );
    renderToStaticMarkup(tree);
    renderToStaticMarkup(tree);
    expect(warn.mock.calls).toEqual([
      [
        "GdHall: gdHall > floor[0], child 0: Pillars is not a hall tag; write it as a function and call it in braces: {pillars()}",
      ],
      [
        "GdHall: gdHall > floor[0], child 1: a GdHall inside a hall is not drawn; a hall has one root, so draw a second GdHall beside this one",
      ],
    ]);
  });

  it("warns once when its children give no node, as tags erased are", () => {
    const warn = quiet();
    const empty = renderToStaticMarkup(<GdHall hall={{ type: "gdHall" }} />);
    // A client component receives tags passed through its props as null.
    expect(renderToStaticMarkup(<GdHall>{null}</GdHall>)).toBe(empty);
    expect(renderToStaticMarkup(<GdHall>{[]}</GdHall>)).toBe(empty);
    expect(warn.mock.calls).toEqual([
      [
        "GdHall drew an empty hall: it was given no `hall`, and its children gave no hall node. Across a client boundary tags arrive as null: build the hall where GdHall runs, or pass hallFromTags(…).hall instead",
      ],
    ]);
  });

  it("stays silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = quiet();
    const Wrapper = () => null;
    renderToStaticMarkup(
      <GdHall compass>
        <Wrapper />
      </GdHall>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("draws the data form as before, its children aside, with a warning", () => {
    const warn = quiet();
    const data = renderToStaticMarkup(<GdHall hall={neophyte.hall} />);
    expect(warn).not.toHaveBeenCalled();
    const props = {
      hall: neophyte.hall,
      children: <Hall.Floor />,
    } as unknown as GdHallProps;
    expect(renderToStaticMarkup(<GdHall {...props} />)).toBe(data);
    expect(warn.mock.calls).toEqual([
      [
        "GdHall was given both `hall` and children: it draws `hall` and ignores the children",
      ],
    ]);
  });
});

describe("GdHall's props types (R1)", () => {
  it("keep 0.1.0's wrappers compiling", () => {
    interface Framed extends GdHallProps {
      frame?: string;
    }
    const Framed = ({ hall, frame: _frame, ...rest }: Framed) => (
      <GdHall hall={hall} {...rest} />
    );
    const Forward = (props: Omit<GdHallProps, "hall"> & { id: string }) => {
      const { id: _id, ...rest } = props;
      return <GdHall hall={neophyte.hall} {...rest} />;
    };
    // 0.2.0's GdHallProps has no children, so a wrapper may add its own.
    interface Captioned extends GdHallProps {
      children?: ReactNode;
    }
    const Captioned = ({ children, ...rest }: Captioned) => (
      <figure>
        <GdHall {...rest} />
        <figcaption>{children}</figcaption>
      </figure>
    );
    const Titled = ({
      children,
      ...rest
    }: GdHallProps & { children?: ReactNode }) => (
      <div title={String(children)}>
        <GdHall {...rest} />
      </div>
    );
    const Spread = (props: ComponentProps<typeof GdHall>) => (
      <GdHall {...props} />
    );
    expect(
      renderToStaticMarkup(
        <>
          <Framed hall={neophyte.hall} frame="gold" />
          <Forward id="x" width={10} />
          <Spread hall={neophyte.hall} />
          <Captioned hall={neophyte.hall}>Neophyte</Captioned>
          <Titled hall={neophyte.hall}>Neophyte</Titled>
        </>,
      ),
    ).toContain("<svg");
    expectTypeOf<GdHallProps>().toExtend<GdHallRenderProps>();
    expectTypeOf<GdHallTagsProps>().toExtend<GdHallRenderProps>();
  });

  it("refuse a form's props in the other", () => {
    // @ts-expect-error a root attribute belongs to the tags form
    <GdHall hall={neophyte.hall} wall="plain" />;
    // @ts-expect-error a hall is drawn from `hall` or from tags, not both
    <GdHall hall={neophyte.hall}>
      <Hall.Floor />
    </GdHall>;
    // @ts-expect-error the tags form needs its tags
    <GdHall wall="plain" />;
    // @ts-expect-error text is a prop of a tag, never a child of the hall
    <GdHall wall="plain">Some text</GdHall>;
    // @ts-expect-error a misspelt render prop is refused in either form
    <GdHall widht={3}>
      <Hall.Floor />
    </GdHall>;
    expect(true).toBe(true);
  });
});
