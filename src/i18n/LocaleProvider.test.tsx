// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import LocaleProvider, { useUiLanguage } from "./LocaleProvider";
import { LOCALE_COOKIE } from "./locales";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
function Probe() {
  const { t, choose, locale } = useUiLanguage();
  const [value, setValue] = useState("synthetic draft");
  return (
    <>
      <p>{t("Save")}</p>
      <textarea
        aria-label="synthetic draft"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="button"
        onClick={() => void choose(locale === "en" ? "he" : "en")}
      >
        change
      </button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  router.refresh.mockReset();
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});
it("renders independently scoped server catalogs without activating a global language", () => {
  const englishHtml = () =>
    renderToString(
      <LocaleProvider locale="en" messages={english}>
        <Probe />
      </LocaleProvider>,
    );
  expect(englishHtml()).toContain("Save");
  expect(
    renderToString(
      <LocaleProvider locale="he" messages={hebrew}>
        <Probe />
      </LocaleProvider>,
    ),
  ).toContain("שמירה");
  expect(englishHtml()).toContain("Save");
});
it("preserves mounted fields, saves the cookie before refreshing, and retains language across stale server props", async () => {
  const view = render(
    <LocaleProvider locale="en" messages={english} policy="private">
      <Probe />
    </LocaleProvider>,
  );
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "synthetic unsaved work" } });
  router.refresh.mockImplementation(() =>
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=he`),
  );
  fireEvent.click(screen.getByRole("button", { name: "change" }));
  await screen.findByText("שמירה");
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  view.rerender(
    <LocaleProvider locale="en" messages={{ ...english }} policy="private">
      <Probe />
    </LocaleProvider>,
  );
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("synthetic unsaved work");
  expect(document.documentElement.dir).toBe("rtl");
});
it("public URLs ignore account hydration and browser preferences", async () => {
  document.cookie = `${LOCALE_COOKIE}=he; Path=/`;
  render(
    <LocaleProvider locale="en" messages={english}>
      <Probe />
    </LocaleProvider>,
  );
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent("magickly:locale-hydrate", { detail: "he" }),
    ),
  );
  expect(screen.getByText("Save")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(router.refresh).not.toHaveBeenCalled();
});
it("reports a blocked preference cookie while preserving the live tab choice", async () => {
  vi.spyOn(document, "cookie", "get").mockReturnValue("");
  vi.spyOn(document, "cookie", "set").mockImplementation(() => {});
  render(
    <LocaleProvider locale="en" messages={english} policy="private">
      <Probe />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "change" }));
  await screen.findByText("שמירה");
  expect(await screen.findByRole("alert")).toBeTruthy();
});
