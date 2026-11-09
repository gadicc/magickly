import type { SearchCatalogue, SearchDocument, SearchResult } from "./types";

const SPELLINGS: Record<string, string> = {
  qabalah: "kabbalah",
  qabbalah: "kabbalah",
  cabala: "kabbalah",
  cabalah: "kabbalah",
  cabbala: "kabbalah",
  kabbala: "kabbalah",
  sephiroth: "sephirot",
  sefirot: "sephirot",
  sefira: "sephirah",
  colour: "color",
  colours: "colors",
};

/** Accent/niqqud insensitive, while retaining Hebrew and other Unicode letters. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'״׳]/g, "")
    .replace(/[^\p{L}\p{N}=]+/gu, " ")
    .trim();
}

export function searchTokens(text: string): string[] {
  return normalizeSearch(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => SPELLINGS[token] ?? token);
}

/** One insertion, deletion, substitution or adjacent transposition, for names. */
function nearName(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const different: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different.push(i);
    return (
      different.length <= 1 ||
      (different.length === 2 &&
        different[1] === different[0] + 1 &&
        a[different[0]] === b[different[1]] &&
        a[different[1]] === b[different[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let at = 0;
  while (at < short.length && short[at] === long[at]) at++;
  return short.slice(at) === long.slice(at + 1);
}

interface Passage {
  document: SearchDocument;
  title: string;
  href: string;
  text: string;
  names: string[];
  frequencies: Map<string, number>;
  length: number;
  page: boolean;
}

/** A source excerpt near the first matched word, with no HTML to inject. */
export function searchExcerpt(
  text: string,
  query: string,
  length = 210,
): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const wanted = searchTokens(query);
  const hit = words.findIndex((word) =>
    searchTokens(word).some((token) =>
      wanted.some((term) => token.startsWith(term)),
    ),
  );
  let start = Math.max(0, hit - 8);
  if (text.length <= length) start = 0;
  let excerpt = "";
  let end = start;
  while (
    end < words.length &&
    (!excerpt || excerpt.length + words[end].length + 1 <= length)
  ) {
    excerpt += (excerpt ? " " : "") + words[end++];
  }
  return `${start ? "…" : ""}${excerpt}${end < words.length ? "…" : ""}`;
}

/** Builds an in-memory lexical index once, outside the input/render path. */
export function createSearchEngine(catalogue: SearchCatalogue) {
  const passages: Passage[] = [];
  const documentFrequency = new Map<string, number>();
  for (const document of catalogue.documents) {
    const pageNames = searchTokens(
      [document.title, ...document.aliases].join(" "),
    );
    const sections = [
      { id: "page", title: "", text: document.description },
      ...document.sections,
    ];
    for (const section of sections) {
      const frequencies = new Map<string, number>();
      const tokens = searchTokens(section.text);
      for (const token of tokens)
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      const names = [...pageNames, ...searchTokens(section.title)];
      for (const name of names)
        frequencies.set(name, (frequencies.get(name) ?? 0) + 4);
      for (const token of frequencies.keys())
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      passages.push({
        document,
        title: section.title,
        href: section.href ?? document.path,
        text: section.text,
        names,
        frequencies,
        length: tokens.length + names.length * 4,
        page: section.id === "page",
      });
    }
  }
  const average =
    passages.reduce((sum, passage) => sum + passage.length, 0) /
    (passages.length || 1);

  return {
    search(query: string, limit = 20): SearchResult[] {
      // Bound user input and work even for a pasted paragraph.
      const terms = [...new Set(searchTokens(query.slice(0, 300)))].slice(
        0,
        16,
      );
      if (!terms.length) return [];
      const phrase = terms.join(" ");
      const grouped = new Map<string, SearchResult>();
      for (const passage of passages) {
        let score = 0;
        let matches = true;
        for (let at = 0; at < terms.length; at++) {
          const term = terms[at];
          let word = term;
          let frequency = passage.frequencies.get(term) ?? 0;
          let penalty = 1;
          if (!frequency) {
            // Prefixes/typos apply to names, never broad fuzzy body matching.
            word =
              passage.names.find(
                (name) =>
                  term.length >= 2 &&
                  at === terms.length - 1 &&
                  name.startsWith(term),
              ) ?? "";
            if (!word) {
              word = passage.names.find((name) => nearName(term, name)) ?? "";
              penalty = 0.35;
            } else penalty = 0.7;
            frequency = passage.frequencies.get(word) ?? 0;
          }
          if (!frequency) {
            matches = false;
            break;
          }
          const count = documentFrequency.get(word) ?? 1;
          const idf = Math.log(
            1 + (passages.length - count + 0.5) / (count + 0.5),
          );
          score +=
            (penalty * idf * frequency * 2.2) /
            (frequency + 1.2 * (0.25 + (0.75 * passage.length) / average));
        }
        if (!matches) continue;
        const exact = [
          passage.document.title,
          ...passage.document.aliases,
        ].some((name) => searchTokens(name).join(" ") === phrase);
        if (exact) score += 100;
        if (searchTokens(passage.document.title).join(" ").includes(phrase))
          score += 12;
        if (passage.page) score += 0.25;
        const result: SearchResult = {
          path: passage.document.path,
          href: passage.href,
          title: passage.document.title,
          section: passage.title || undefined,
          excerpt: searchExcerpt(passage.text, query),
          score,
          match: exact || passage.page ? "page" : "content",
          exactTitle: exact,
        };
        const previous = grouped.get(result.path);
        if (!previous || result.score > previous.score)
          grouped.set(result.path, result);
      }
      return [...grouped.values()]
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
        .slice(0, Math.max(0, Math.min(limit, 50)));
    },
  };
}
