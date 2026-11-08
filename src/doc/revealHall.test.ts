// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusHall, revealHall } from "./revealHall";

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("revealHall", () => {
  it("opens every details the figure is in and sets the hash to it", () => {
    document.body.innerHTML = `
      <details id="outer"><summary>Outer</summary>
        <div><details id="inner"><summary>Inner</summary>
          <figure id="hall-2"></figure>
        </details></div>
      </details>
      <details id="other"></details>`;
    expect(revealHall(2)).toBe(true);
    expect(location.hash).toBe("#hall-2");
    const open = (id: string) =>
      (document.getElementById(id) as HTMLDetailsElement).open;
    expect([open("outer"), open("inner"), open("other")]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("scrolls itself when the hash already names the hall", () => {
    document.body.innerHTML = `<figure id="hall-1"></figure>`;
    history.replaceState(null, "", "/#hall-1");
    const figure = document.getElementById("hall-1") as HTMLElement;
    figure.scrollIntoView = vi.fn();
    expect(revealHall(1)).toBe(true);
    expect(figure.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("scrolls in a document with no window", () => {
    const detached = document.implementation.createHTMLDocument("");
    detached.body.innerHTML = `<figure id="hall-3"></figure>`;
    const figure = detached.getElementById("hall-3") as HTMLElement;
    figure.scrollIntoView = vi.fn();
    expect(revealHall(3, detached)).toBe(true);
    expect(figure.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("does nothing for a hall that is not drawn", () => {
    expect(revealHall(9)).toBe(false);
    expect(location.hash).toBe("");
  });
});

describe("focusHall", () => {
  it("focuses the figure without scrolling, and only from script", () => {
    document.body.innerHTML = `<figure id="hall-1"></figure>`;
    const figure = document.getElementById("hall-1") as HTMLElement;
    const focus = vi.spyOn(figure, "focus");
    focusHall(1);
    expect(figure.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(figure);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("keeps a tabindex the figure has, and ignores a hall not drawn", () => {
    document.body.innerHTML = `<figure id="hall-1" tabindex="0"></figure>`;
    focusHall(1);
    expect((document.getElementById("hall-1") as HTMLElement).tabIndex).toBe(0);
    focusHall(5);
  });
});
