// @vitest-environment jsdom
import { ThemeProvider } from "@mui/material/styles";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_COLOR_MODE } from "@/colorScheme";
import theme from "@/theme";
import ThemeSwitch from "./ThemeSwitch";

function App() {
  return (
    <ThemeProvider theme={theme} defaultMode={DEFAULT_COLOR_MODE}>
      <ThemeSwitch />
    </ThemeProvider>
  );
}

const roots: { unmount(): void }[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  document.documentElement.className = "";
  localStorage.clear();
});

function pressed(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Theme"] button',
    ),
  ]
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);
}

function button(container: HTMLElement, label: string) {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Theme"] button',
    ),
  ].find((b) => b.textContent === label);
  if (!found) throw new Error(`no ${label} button`);
  return found;
}

/** Server-renders the switch, then hydrates it; returns the container. */
async function hydrate() {
  const html = renderToString(<App />);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  // What the server sent: nothing chosen, whatever is stored.
  expect(pressed(container)).toEqual([]);
  const recoverable = vi.fn();
  await act(async () => {
    roots.push(
      hydrateRoot(container, <App />, { onRecoverableError: recoverable }),
    );
  });
  expect(recoverable).not.toHaveBeenCalled();
  expect(logged).not.toHaveBeenCalled();
  logged.mockRestore();
  return container;
}

it("labels the group and each choice", async () => {
  const html = renderToString(<App />);
  expect(html).toMatch(/role="group"[^>]*aria-label="Theme"/);
  for (const label of ["Light", "System", "Dark"])
    expect(html).toContain(`>${label}</button>`);
});

it("selects nothing until mounted, then the stored choice", async () => {
  localStorage.setItem("mui-mode", "dark");
  const container = await hydrate();
  expect(pressed(container)).toEqual(["Dark"]);
});

it("selects System when nothing is stored", async () => {
  const container = await hydrate();
  expect(pressed(container)).toEqual(["System"]);
});

it("sets the mode on a click, and keeps it on a second click", async () => {
  const container = await hydrate();
  await act(async () => button(container, "Dark").click());
  expect(pressed(container)).toEqual(["Dark"]);
  expect(localStorage.getItem("mui-mode")).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);

  // Clicking the chosen one again cannot leave nothing chosen.
  await act(async () => button(container, "Dark").click());
  expect(pressed(container)).toEqual(["Dark"]);
  expect(localStorage.getItem("mui-mode")).toBe("dark");

  await act(async () => button(container, "Light").click());
  expect(pressed(container)).toEqual(["Light"]);
  expect(localStorage.getItem("mui-mode")).toBe("light");
  expect(document.documentElement.classList.contains("light")).toBe(true);
});
