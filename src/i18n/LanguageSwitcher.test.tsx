// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LanguageSwitcher from "./LanguageSwitcher";

const state = vi.hoisted(() => ({
  pathname: "/about",
  locale: "en",
  policy: "public",
  changing: false,
  error: null as string | null,
  choose: vi.fn(async () => false),
  t: (s: string) => s,
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("./LocaleProvider", () => ({ useUiLanguage: () => state }));
afterEach(() => {
  cleanup();
  state.pathname = "/about";
  state.policy = "public";
  state.locale = "en";
  state.error = null;
  state.changing = false;
  state.choose.mockClear();
});

it("shows a drawer row and native language choices with decorative flags", async () => {
  render(<LanguageSwitcher />);
  expect(
    screen.getByRole("combobox", { name: "Language" }).textContent,
  ).toContain("English");
  fireEvent.mouseDown(screen.getByRole("combobox"));
  const option = await screen.findByRole("option", { name: "עברית" });
  expect(option.getAttribute("aria-disabled")).not.toBe("true");
  expect(option.textContent).toContain("🇮🇱");
  fireEvent.click(option);
  expect(state.choose).toHaveBeenCalledWith("he");
});
it("explains a missing public edition and offers the Hebrew homepage", async () => {
  state.pathname = "/astrology";
  render(<LanguageSwitcher />);
  expect(
    screen.getByText("This page isn’t available in Hebrew yet."),
  ).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/he");
  fireEvent.mouseDown(screen.getByRole("combobox"));
  expect(
    (await screen.findByRole("option", { name: "עברית" })).getAttribute(
      "aria-disabled",
    ),
  ).toBe("true");
});
it("allows Hebrew on private URLs without needing a public edition", async () => {
  state.pathname = "/temples";
  state.policy = "private";
  render(<LanguageSwitcher />);
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "עברית" }));
  expect(state.choose).toHaveBeenCalledWith("he");
});
