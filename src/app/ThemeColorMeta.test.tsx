// @vitest-environment jsdom
import { ThemeProvider } from "@mui/material/styles";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DEFAULT_COLOR_MODE, THEME_COLOR } from "@/colorScheme";
import theme from "@/theme";
import ThemeColorMeta from "./ThemeColorMeta";
import ThemeSwitch from "./ThemeSwitch";

/** The two metas `viewport.themeColor` gives the head. */
function addMetas() {
  for (const [media, color] of [
    ["(prefers-color-scheme: light)", THEME_COLOR.light],
    ["(prefers-color-scheme: dark)", THEME_COLOR.dark],
  ]) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    // An attribute, as Next writes it: jsdom has no `media` property.
    meta.setAttribute("media", media);
    meta.content = color;
    document.head.append(meta);
  }
}

function contents() {
  return [
    ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
  ].map((meta) => meta.content);
}

/** Chooses a mode the reader's way, with the drawer's switch. */
function choose(label: string) {
  const button = [
    ...screen
      .getByRole("group", { name: "Theme" })
      .querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === label);
  if (!button) throw new Error(`no ${label} button`);
  button.click();
}

function mount() {
  return render(
    <ThemeProvider theme={theme} defaultMode={DEFAULT_COLOR_MODE}>
      <ThemeColorMeta />
      <ThemeSwitch />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  addMetas();
});
function removeMetas() {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
    meta.remove();
}

afterEach(() => {
  cleanup();
  removeMetas();
  document.documentElement.className = "";
  localStorage.clear();
});

it("leaves each meta its own media's colour under System", () => {
  mount();
  expect(contents()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
});

it("points both metas at an explicit choice, and restores them for System", async () => {
  mount();
  await act(async () => choose("Dark"));
  expect(contents()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  await act(async () => choose("Light"));
  expect(contents()).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
  await act(async () => choose("System"));
  expect(contents()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
});

it("applies a stored choice on load and to metas Next puts back later", async () => {
  localStorage.setItem("mui-mode", "dark");
  mount();
  expect(contents()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  // A navigation replaces the head's metas with the layout's originals.
  removeMetas();
  addMetas();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(contents()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
});
