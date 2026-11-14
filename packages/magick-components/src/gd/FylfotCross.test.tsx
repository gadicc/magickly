import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FylfotCross, {
  FYLFOT_CELLS,
  type FylfotCell,
  fylfotSymbolTable,
} from "./FylfotCross.tsx";

/** Every element in a tree a component returned, its own included. */
function elements(node: ReactNode): { type: unknown; props: object }[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [{ type: node.type, props }, ...elements(props.children)];
}

describe("FylfotCross", () => {
  it("passes no click handler without onCellClick, so it can render on the server", () => {
    // A Server Component may not hand a function to the browser: a handler
    // on a <td> fails the page's prerender.
    const handlers = elements(FylfotCross({})).filter(
      ({ props }) => "onClick" in props && props.onClick !== undefined,
    );
    expect(handlers).toEqual([]);
    expect(renderToStaticMarkup(<FylfotCross />)).toContain("☉");
  });

  it("calls onCellClick with the square it was given", () => {
    const onCellClick = vi.fn();
    const cells = FYLFOT_CELLS.map((row) => [...row]) as FylfotCell[][];
    cells[1][4] = "";
    cells[2][0] = "aries";
    const squares = elements(FylfotCross({ cells, onCellClick })).filter(
      ({ type, props }) =>
        type === "td" && (props as { onClick?: unknown }).onClick,
    );
    // Every square but the empty one shows a symbol; all take clicks.
    expect(squares).toHaveLength(17);
    const click = (index: number) =>
      (squares[index].props as { onClick: () => void }).onClick();
    click(0);
    expect(onCellClick).toHaveBeenLastCalledWith({
      id: "fire",
      row: 0,
      column: 0,
      expected: "fire",
    });
    click(5);
    expect(onCellClick).toHaveBeenLastCalledWith({
      id: "",
      row: 1,
      column: 4,
      expected: "pisces",
    });
    click(6);
    expect(onCellClick).toHaveBeenLastCalledWith({
      id: "aries",
      row: 2,
      column: 0,
      expected: "taurus",
    });
  });

  it("sets its symbols in a monospace font that survives a client render", () => {
    expect(renderToStaticMarkup(<FylfotCross />)).toContain(
      "font-family:monospace",
    );
    expect(renderToStaticMarkup(<FylfotCross />)).not.toContain("!important");
  });

  it("names the table each symbol comes from", () => {
    expect(fylfotSymbolTable("sol")).toBe("planet");
    expect(fylfotSymbolTable("water")).toBe("element");
    expect(fylfotSymbolTable("leo")).toBe("zodiac");
  });

  it("borders its squares in the ink it is given, black by default", () => {
    const plain = renderToStaticMarkup(<FylfotCross />);
    expect(plain).toContain(
      "border: 1px solid var(--magick-fylfot-cross-ink, black);",
    );
    expect(plain).not.toContain("--mui-");
    expect(plain).toMatch(/<table class="magick-fylfot-cross">/);
    expect(
      renderToStaticMarkup(<FylfotCross ink="var(--site-ink, black)" />),
    ).toMatch(
      /<table class="magick-fylfot-cross" style="--magick-fylfot-cross-ink:var\(--site-ink, black\)">/,
    );
  });
});
