import { createCompiledCatalog } from "@lingui/cli/api";
import { formatter } from "@lingui/format-po";

export const catalogFormat = formatter({ lineNumbers: false });
export type Catalog = Awaited<ReturnType<typeof catalogFormat.parse>>;

/** One first-party source message and its translator context. */
export interface TranslationCandidate {
  id: string;
  source: string;
  comments: string[];
}

function catalogFlags(entry: Catalog[string]): string[] {
  const flags = entry.extra?.flags;
  return Array.isArray(flags)
    ? flags.filter((flag): flag is string => typeof flag === "string")
    : [];
}

/** Existing non-fuzzy translations are deliberately left alone. */
export function translationCandidates(
  catalog: Catalog,
): TranslationCandidate[] {
  return Object.entries(catalog).flatMap(([id, entry]) =>
    !entry.obsolete &&
    (!entry.translation || catalogFlags(entry).includes("fuzzy"))
      ? [
          {
            id,
            source: entry.message || id,
            comments: [
              ...(entry.comments || []),
              ...(entry.context ? [`Context: ${entry.context}`] : []),
            ],
          },
        ]
      : [],
  );
}

function signature(message: string, locale: string) {
  const compiled = createCompiledCatalog(
    locale,
    { value: message },
    { namespace: "json", strict: true },
  );
  if (compiled.errors.length) throw new Error("Invalid ICU message");
  const variables = new Set<string>();
  const selectors = new Set<string>();
  function visit(node: unknown) {
    if (!Array.isArray(node)) return;
    if (
      typeof node[0] === "string" &&
      (node.length === 1 || typeof node[1] === "string")
    ) {
      const [name, type = "argument", branches] = node;
      variables.add(`${name}:${type}`);
      if (branches && typeof branches === "object") {
        for (const [branch, value] of Object.entries(branches)) {
          if (
            type === "select" ||
            /^-?\d+$/.test(branch) ||
            branch === "offset"
          )
            selectors.add(
              `${name}:${branch}:${branch === "offset" ? value : ""}`,
            );
          if (Array.isArray(value)) value.forEach(visit);
        }
        if (!("other" in branches))
          throw new Error("ICU choice needs an other branch");
      }
      return;
    }
    node.forEach(visit);
  }
  const tokens = JSON.parse(compiled.source).messages.value;
  if (Array.isArray(tokens)) tokens.forEach(visit);
  const tags: string[] = [],
    stack: string[] = [];
  for (const match of message.matchAll(/<[^>]*>/g)) {
    const tag = /^<(\/)?([a-zA-Z0-9]+)(\/)?>$/.exec(match[0]);
    if (!tag)
      throw new Error(
        "Translations cannot supply HTML attributes or unknown markup",
      );
    const [, closing, name, selfClosing] = tag;
    if (closing) {
      if (stack.pop() !== name) throw new Error("Unbalanced component tags");
    } else {
      tags.push(`${name}:${selfClosing ? "void" : "pair"}`);
      if (!selfClosing) stack.push(name);
    }
  }
  if (stack.length) throw new Error("Unbalanced component tags");
  return {
    variables: [...variables].sort(),
    selectors: [...selectors].sort(),
    tags: [...new Set(tags)].sort(),
  };
}

/** Reject broken interpolation, ICU controls or React component placeholders before writing. */
export function validateTranslation(
  source: string,
  translation: string,
  locale: string,
) {
  if (!translation.trim()) throw new Error("Empty translation");
  if (
    JSON.stringify(signature(source, "en")) !==
    JSON.stringify(signature(translation, locale))
  )
    throw new Error(
      "Translation changed placeholders, ICU controls or component tags",
    );
}

/** A batch is all-or-nothing; no candidate mutates the caller's catalog. */
export function applyTranslations(
  catalog: Catalog,
  candidates: TranslationCandidate[],
  translations: { id: number; text: string }[],
  locale: string,
): Catalog {
  if (translations.length !== candidates.length)
    throw new Error("Incomplete translation batch");
  const result = structuredClone(catalog);
  const seen = new Set<number>();
  for (const { id, text } of translations) {
    if (!Number.isInteger(id) || !candidates[id] || seen.has(id))
      throw new Error("Invalid or duplicate translation id");
    seen.add(id);
    const candidate = candidates[id];
    validateTranslation(candidate.source, text, locale);
    result[candidate.id].translation = text;
    const entry = result[candidate.id];
    entry.extra = {
      ...entry.extra,
      flags: catalogFlags(entry).filter((flag) => flag !== "fuzzy"),
    };
  }
  return result;
}
