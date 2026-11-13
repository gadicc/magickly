import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FylfotCross from "./fylfot-cross.tsx";

/** Every element in a tree a component returned, its own included. */
function elements(node: ReactNode): { type: unknown; props: object }[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [{ type: node.type, props }, ...elements(props.children)];
}

describe("FylfotCross", () => {
  it("passes no click handler without onClick, so it can render on the server", () => {
    // A Server Component may not hand a function to the browser: a handler
    // on a <td> fails the page's prerender.
    const handlers = elements(FylfotCross({})).filter(
      ({ props }) => "onClick" in props && props.onClick !== undefined,
    );
    expect(handlers).toEqual([]);
    expect(renderToStaticMarkup(<FylfotCross />)).toContain("☉");
  });

  it("calls onClick with the square it was given", () => {
    const onClick = vi.fn();
    const squares = elements(FylfotCross({ onClick })).filter(
      ({ type, props }) =>
        type === "td" && (props as { onClick?: unknown }).onClick,
    );
    expect(squares.length).toBeGreaterThan(0);
    (squares[0].props as { onClick: () => void }).onClick();
    expect(onClick).toHaveBeenCalledWith("fire", 0, 0, "fire");
  });
});
