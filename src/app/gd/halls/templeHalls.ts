/**
 * The temple tabs of `/gd/halls` (plan 069, decision 7): the catalog's
 * reply, the tabs it makes, the order of a tab's rituals and the hash that
 * names the open tab. No React and no I/O.
 */

/** Does nothing: for promises whose failure leaves things as they were. */
export const ignore = (): void => {};

/** One entry of `GET /api/rituals/catalog` (stage 3a). */
export interface CatalogRitual {
  id: string;
  title: string;
  templeSlug: string;
  /** The temple's display name; the slug when the reply has none. */
  templeName: string;
  hallCount: number;
}

/**
 * The catalog's rituals, or null when the reply is not the expected shape:
 * a client must not act (fetch or recheck) on a reply it cannot read.
 */
export function parseCatalog(value: unknown): CatalogRitual[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rituals = (value as { rituals?: unknown }).rituals;
  if (!Array.isArray(rituals)) return null;
  const parsed: CatalogRitual[] = [];
  for (const entry of rituals) {
    if (!entry || typeof entry !== "object") return null;
    const { id, title, templeSlug, templeName, hallCount } = entry as Record<
      string,
      unknown
    >;
    if (
      typeof id !== "string" ||
      typeof title !== "string" ||
      typeof templeSlug !== "string" ||
      !templeSlug ||
      typeof hallCount !== "number" ||
      !Number.isInteger(hallCount) ||
      hallCount < 0
    )
      return null;
    parsed.push({
      id,
      title,
      templeSlug,
      templeName:
        typeof templeName === "string" && templeName.trim()
          ? templeName
          : templeSlug,
      hallCount,
    });
  }
  return parsed;
}

/** "Portal" sorts after 4=7 and before 5=6. */
const PORTAL = 4.5;
const GRADE = /(?<!\d)(\d+)\s*°?\s*=\s*(\d+)\s*□?/u;
const PORTAL_WORD = /\bPortal\b/iu;

/**
 * A grade ritual's place from its title: the first number of a grade
 * written `0=0`, `1 = 10` or `1°=10□`, or 4.5 for "Portal" as a word;
 * null for any other ritual.
 */
export function ritualGrade(title: string): number | null {
  const grade = GRADE.exec(title);
  if (grade) return Number(grade[1]);
  return PORTAL_WORD.test(title) ? PORTAL : null;
}

const byTitle = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Grade rituals first, by grade (numerically), then the others by title. */
export function compareRituals(
  a: Pick<CatalogRitual, "title">,
  b: Pick<CatalogRitual, "title">,
): number {
  const gradeA = ritualGrade(a.title);
  const gradeB = ritualGrade(b.title);
  if (gradeA !== null && gradeB !== null && gradeA !== gradeB)
    return gradeA - gradeB;
  if (gradeA !== null && gradeB === null) return -1;
  if (gradeA === null && gradeB !== null) return 1;
  return byTitle(a.title, b.title);
}

/** Each temple's display name, by slug. */
export function templeNames(
  catalog: readonly CatalogRitual[],
): Map<string, string> {
  return new Map(
    catalog.map((ritual) => [ritual.templeSlug, ritual.templeName]),
  );
}

/** The temples with at least one hall, in name order. */
export function templeTabs(catalog: readonly CatalogRitual[]): string[] {
  const names = templeNames(catalog);
  const name = (slug: string) => names.get(slug) ?? slug;
  return [
    ...new Set(
      catalog
        .filter((ritual) => ritual.hallCount > 0)
        .map((ritual) => ritual.templeSlug),
    ),
  ].sort((a, b) => byTitle(name(a), name(b)));
}

/** A temple's rituals with halls, in the order its tab shows them. */
export function templeRituals(
  catalog: readonly CatalogRitual[],
  slug: string,
): CatalogRitual[] {
  return catalog
    .filter((ritual) => ritual.templeSlug === slug && ritual.hallCount > 0)
    .sort(compareRituals);
}

/** The temple named by a `#temple=<slug>` hash, if any. */
export function hashTemple(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  return new URLSearchParams(hash.slice(1)).get("temple") || null;
}

/** The hash for a temple's tab. */
export function templeHash(slug: string): string {
  return `#temple=${encodeURIComponent(slug)}`;
}

/** A remembered tab, as the offline repository holds it. */
export type RememberedTab = { slug: string } | { standard: true } | null;

/**
 * The tab `/gd/halls` opens (decision 7): the hash's temple when it has a
 * tab; else the remembered temple when it still has one, or a remembered
 * Standard; else the only temple; else Standard (null). `forget` is set
 * when the remembered temple has no tab any more and its record should go.
 */
export function chooseTab(options: {
  temples: readonly string[];
  hash: string | null;
  remembered: RememberedTab;
}): { tab: string | null; forget: boolean } {
  const { temples, hash, remembered } = options;
  const slug = remembered && "slug" in remembered ? remembered.slug : null;
  const forget = slug !== null && !temples.includes(slug);
  if (hash !== null && temples.includes(hash)) return { tab: hash, forget };
  if (slug !== null && !forget) return { tab: slug, forget };
  if (remembered && "standard" in remembered) return { tab: null, forget };
  return { tab: temples.length === 1 ? temples[0] : null, forget };
}
