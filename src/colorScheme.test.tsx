// @vitest-environment jsdom
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_COLOR_MODE,
  noStorageColorSchemeScript,
} from "./colorScheme";

/** MUI's own inline script, as the layout renders it. */
const muiScript =
  renderToStaticMarkup(
    <InitColorSchemeScript
      attribute={COLOR_SCHEME_ATTRIBUTE}
      defaultMode={DEFAULT_COLOR_MODE}
    />,
  ).match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";

function run(script: string) {
  new Function(script)();
}

/** A device that prefers dark (or not). */
function prefers(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark && query === "(prefers-color-scheme: dark)",
      media: query,
    })),
  );
}

/** Storage that throws on every read, as when site data is blocked. */
function blockStorage() {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.className = "";
});

describe("the class for blocked storage", () => {
  it("is needed: MUI's script sets no class when storage throws", () => {
    expect(DEFAULT_COLOR_MODE).toBe("system");
    expect(muiScript).toContain("localStorage.getItem");
    prefers(true);
    blockStorage();
    run(muiScript);
    expect(document.documentElement.className).toBe("");
  });

  it("follows the device after MUI's script when storage throws", () => {
    blockStorage();
    prefers(true);
    run(muiScript);
    run(noStorageColorSchemeScript);
    expect([...document.documentElement.classList]).toEqual(["dark"]);

    document.documentElement.className = "";
    prefers(false);
    run(muiScript);
    run(noStorageColorSchemeScript);
    expect([...document.documentElement.classList]).toEqual(["light"]);
  });

  it("leaves a class MUI's script set alone", () => {
    prefers(true);
    localStorage.setItem("mui-mode", "light");
    run(muiScript);
    run(noStorageColorSchemeScript);
    expect([...document.documentElement.classList]).toEqual(["light"]);

    document.documentElement.className = "dark";
    prefers(false);
    run(noStorageColorSchemeScript);
    expect([...document.documentElement.classList]).toEqual(["dark"]);
  });

  it("swallows a missing matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => run(noStorageColorSchemeScript)).not.toThrow();
    expect(document.documentElement.className).toBe("");
  });
});
