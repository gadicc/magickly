import { describe, expect, it } from "vitest";
import {
  applyTranslations,
  catalogFormat,
  translationCandidates,
  validateTranslation,
} from "./translation";

describe("translation validation", () => {
  it("allows natural reordering and Hebrew plural categories", () => {
    expect(() =>
      validateTranslation("Hello <0>{name}</0>", "<0>{name}</0>, שלום", "he"),
    ).not.toThrow();
    expect(() =>
      validateTranslation(
        "{count, plural, one {One item} other {# items}}",
        "{count, plural, one {פריט} two {שני פריטים} other {# פריטים}}",
        "he",
      ),
    ).not.toThrow();
    expect(() =>
      validateTranslation("Plain copy", "טקסט פשוט", "he"),
    ).not.toThrow();
  });
  it.each([
    ["Hello {name}", "שלום"],
    ["Hello {name}", "שלום {other}"],
    ["<0>Read</0>", "<0 href='https://example.test'>קריאה</0>"],
    ["<0>Read</0>", "<1>קריאה</1>"],
    ["<0><1>Read</1></0>", "<0><1>קריאה</0></1>"],
    ["{n, plural, =0 {None} other {#}}", "{n, plural, other {#}}"],
    [
      "{kind, select, a {A} other {Other}}",
      "{kind, select, b {ב} other {אחר}}",
    ],
    ["{n, plural, one {One} other {#}}", "{n}"],
    ["Hello", ""],
    ["Hello", "{n, plural, one {לא סגור}"],
  ])("rejects broken messages: %s", (source, translation) => {
    expect(() => validateTranslation(source, translation, "he")).toThrow();
  });
});

it("retranslates only missing/fuzzy messages, atomically, preserving reviewed translations and metadata", async () => {
  const catalog = await catalogFormat.parse(
    `msgid ""\nmsgstr ""\n"Language: he\\n"\n\n#. js-lingui-explicit-id\nmsgid "Kept"\nmsgstr "נשמר"\n\n#. Context for translator\n#. js-lingui-explicit-id\n#, fuzzy\nmsgid "Hello {name}"\nmsgstr "ישן"\n\n#. js-lingui-explicit-id\nmsgid "New"\nmsgstr ""\n\n#~ msgid "Obsolete"\n#~ msgstr ""\n`,
    { locale: "he", sourceLocale: "en", filename: "fixture.po" },
  );
  const candidates = translationCandidates(catalog);
  expect(candidates.map((c) => c.id)).toEqual(["Hello {name}", "New"]);
  expect(candidates[0].comments).toContain("Context for translator");
  const before = structuredClone(catalog);
  expect(() =>
    applyTranslations(
      catalog,
      candidates,
      [
        { id: 0, text: "שלום {name}" },
        { id: 1, text: "" },
      ],
      "he",
    ),
  ).toThrow();
  expect(catalog).toEqual(before);
  expect(() =>
    applyTranslations(
      catalog,
      candidates,
      [{ id: 0, text: "שלום {name}" }],
      "he",
    ),
  ).toThrow();
  expect(() =>
    applyTranslations(
      catalog,
      candidates,
      [
        { id: 0, text: "שלום {name}" },
        { id: 0, text: "שלום {name}" },
      ],
      "he",
    ),
  ).toThrow();
  const next = applyTranslations(
    catalog,
    candidates,
    [
      { id: 1, text: "חדש" },
      { id: 0, text: "שלום {name}" },
    ],
    "he",
  );
  expect(next.Kept).toEqual(before.Kept);
  expect(next["Hello {name}"].extra?.flags).not.toContain("fuzzy");
  expect(next["Hello {name}"].comments).toEqual(
    before["Hello {name}"].comments,
  );
  expect(catalog).toEqual(before);
});
