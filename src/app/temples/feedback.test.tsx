// @vitest-environment jsdom
import { setupI18n } from "@lingui/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LocaleProvider, { useUiLanguage } from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { templeFeedback } from "./feedback";
import TempleFeedback from "./TempleFeedback";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(cleanup);

const en = setupI18n({ locale: "en", messages: { en: english } });
const he = setupI18n({ locale: "he", messages: { he: hebrew } });
function translated(text: unknown, language = en) {
  const { message, values } = templeFeedback(text);
  return language._(message, values);
}

it("recognizes safe action failures without interpreting arbitrary URL/provider copy", () => {
  expect(
    translated(
      "A temple needs an administrator. Make another member an administrator first.",
      he,
    ),
  ).toContain("למנות חבר אחר");
  for (const input of [
    undefined,
    null,
    [],
    {},
    "Your temple membership is active.",
    "<img src=x onerror=alert(1)>",
    "Skipped member 2: constructor.",
    "Skipped member 2: unexpected provider detail.",
  ]) {
    expect(translated(input)).toBe(
      "The temple action returned an unrecognized result. Refresh the page and try again.",
    );
  }
});

it("localizes retained sync counters and reasons as whole messages", () => {
  expect(translated("Synced member 2 of 10.", he)).toBe(
    "סונכרן חבר 2 מתוך 10.",
  );
  expect(
    translated("Skipped member 3: there is no verified email available.", he),
  ).toContain("אין כתובת דוא״ל מאומתת");
  expect(
    translated(
      "Skipped member 4: forum account creation had an unresolved outcome; reconciliation is required before retrying.",
      he,
    ),
  ).toContain("יש לברר את מצב החשבון");
  for (const count of [1, 2, 11]) {
    const suffix = count === 1 ? "" : "s";
    const summary = `Sync completed with ${count} member${suffix} skipped.`;
    const removed = `Removed ${count} former member${suffix} from forum grade groups.`;
    expect(translated(summary)).toBe(summary);
    expect(translated(removed)).toBe(removed);
    expect(translated(summary, he)).toContain("דילוג");
    expect(translated(removed, he)).toContain("מקבוצות הדרגות");
  }
});

it("rejects out-of-range counters rather than losing integer precision", () => {
  for (const text of [
    "Skipped member 9007199254740992: membership changed.",
    "Synced member 9007199254740992 of 10.",
    "Synced member 1 of 9007199254740992.",
    "Sync completed with 9007199254740992 members skipped.",
    "Removed 9007199254740992 former members from forum grade groups.",
  ])
    expect(translated(text)).toContain("unrecognized result");
});

function RetainedResult() {
  const { choose } = useUiLanguage();
  return (
    <>
      <button type="button" onClick={() => void choose("he")}>
        Hebrew
      </button>
      <TempleFeedback text="The forum connection was saved." />
    </>
  );
}

it("retranslates a retained action result after an in-place language change", async () => {
  render(
    <LocaleProvider locale="en" messages={english} policy="private">
      <RetainedResult />
    </LocaleProvider>,
  );
  expect(screen.getByText("The forum connection was saved.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hebrew" }));
  expect(await screen.findByText("החיבור לפורום נשמר.")).toBeTruthy();
});
