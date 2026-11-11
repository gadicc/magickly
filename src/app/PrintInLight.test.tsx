// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PrintInLight from "./PrintInLight";

const root = document.documentElement;
const print = (event: "beforeprint" | "afterprint") =>
  window.dispatchEvent(new Event(event));

afterEach(() => {
  cleanup();
  root.className = "";
});

it("prints a dark page light and puts dark back afterwards", () => {
  root.className = "dark";
  render(<PrintInLight />);
  print("beforeprint");
  expect([...root.classList]).toEqual(["light"]);
  print("afterprint");
  expect([...root.classList]).toEqual(["dark"]);
});

it("leaves a light page light", () => {
  root.className = "light";
  render(<PrintInLight />);
  print("beforeprint");
  expect([...root.classList]).toEqual(["light"]);
  print("afterprint");
  expect([...root.classList]).toEqual(["light"]);
});

it("stops listening when unmounted", () => {
  root.className = "dark";
  const { unmount } = render(<PrintInLight />);
  unmount();
  print("beforeprint");
  expect([...root.classList]).toEqual(["dark"]);
});
