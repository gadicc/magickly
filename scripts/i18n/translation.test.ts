import { describe, expect, it } from "vitest";
import {
  applyTranslations,
  catalogFormat,
  translationCandidates,
  validateTranslation,
} from "./translation.mts";

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

it("preserves real origin/context metadata and emits domain context for the provider", async () => {
  const { createTranslationPlan } = await import("@gadicc/loom/i18n");
  const { translationContext } = await import("./context");
  const { catalogMessages } = await import("./translation.mts");
  const catalog = await catalogFormat.parse(
    `#. Button meaning\n#. js-lingui-explicit-id\n#: src/app/enochian/translate/page.tsx:12\nmsgctxt "button"\nmsgid "Order"\nmsgstr ""\n`,
    { locale: "he", sourceLocale: "en", filename: "fixture.po" },
  );
  const messages = catalogMessages(catalog);
  expect(messages[0].context).toBe("button");
  expect(messages[0].origins).toEqual(["src/app/enochian/translate/page.tsx"]);
  const plan = createTranslationPlan(messages, translationContext, {
    sourceLanguage: "English",
    targetLanguage: "Hebrew",
    targetLocale: "he",
  });
  expect(plan.batches[0].system).toContain("occult reference");
  expect(plan.batches[0].prompt).toContain("Enochian translator");
  expect(plan.batches[0].prompt).toContain("Button meaning");
  expect(plan.batches[0].prompt).not.toContain("js-lingui-explicit-id");
});

it("leaves the original catalog unchanged when a later batch fails", async () => {
  const { createTranslationPlan } = await import("@gadicc/loom/i18n");
  const { catalogMessages, translateCatalog } = await import(
    "./translation.mts"
  );
  const { translationContext } = await import("./context");
  const catalog = await catalogFormat.parse(
    'msgid "One"\nmsgstr ""\n\nmsgid "Two"\nmsgstr ""\n',
    { locale: "he", sourceLocale: "en", filename: "fixture.po" },
  );
  const before = structuredClone(catalog);
  const plan = createTranslationPlan(
    catalogMessages(catalog),
    translationContext,
    {
      sourceLanguage: "English",
      targetLanguage: "Hebrew",
      targetLocale: "he",
      maxMessages: 1,
    },
  );
  let calls = 0;
  await expect(
    translateCatalog(catalog, plan, "he", async () => {
      if (++calls === 2) throw new Error("Provider failed");
      return [{ id: 0, text: "אחד" }];
    }),
  ).rejects.toThrow();
  expect(calls).toBe(2);
  expect(catalog).toEqual(before);
});

it("builds offline transport fixtures for twenty source messages with an unchanged stable prefix", async () => {
  const { default: messages } = await import("./fixtures/messages.json");
  const { createTranslationPlan } = await import("@gadicc/loom/i18n");
  const { translationContext } = await import("./context");
  expect(messages).toHaveLength(20);
  const options = {
    sourceLanguage: "English",
    targetLanguage: "Hebrew",
    targetLocale: "he",
  };
  const enriched = createTranslationPlan(messages, translationContext, options);
  const siteOnly = createTranslationPlan(
    messages,
    { ...translationContext, scopes: [] },
    options,
  );
  expect(enriched.batches.flatMap((b) => b.messages)).toHaveLength(20);
  expect(enriched.batches[0].system).toBe(siteOnly.batches[0].system);
  expect(enriched.coverage.some((c) => c.usage.scopes.length)).toBe(true);
});

it("allows rich component placeholders in added Hebrew and removed Japanese plural branches", () => {
  const source = "{n, plural, one {<0>#</0> item} other {<0>#</0> items}}";
  expect(() =>
    validateTranslation(
      source,
      "{n, plural, one {<0>#</0> פריט} two {<0>#</0> פריטים} other {<0>#</0> פריטים}}",
      "he",
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(source, "{n, plural, other {<0>#</0> 個}}", "ja"),
  ).not.toThrow();
});

it("uses canonical English source for explicit catalog identifiers", async () => {
  const { catalogMessages } = await import("./translation.mts");
  const source = await catalogFormat.parse(
    '#. js-lingui-explicit-id\nmsgid "site.title"\nmsgstr "Magick reference"\n',
    { locale: "en", sourceLocale: "en", filename: "en.po" },
  );
  const target = await catalogFormat.parse(
    '#. js-lingui-explicit-id\nmsgid "site.title"\nmsgstr ""\n',
    { locale: "he", sourceLocale: "en", filename: "he.po" },
  );
  expect(catalogMessages(target, source)[0].source).toBe("Magick reference");
});
