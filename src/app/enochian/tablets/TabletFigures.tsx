"use client";
import type { TabletName } from "magick-data/enochian/tabletNames";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiText from "@/i18n/UiText";
import type { TabletPngFile } from "@/seo/tablets";
import { PrevNext } from "@/ui/entity";
import {
  ELEMENT_WORDS,
  type GroupKey,
  groupLabel,
  nameLabel,
} from "./nameWords";
import styles from "./tabletPage.module.css";
import {
  TABLET_LEDE,
  TABLET_PAGE_LABELS,
  type TabletPageId,
  tabletAlt,
  tabletPath,
} from "./tabletPages";

/**
 * What a tablet's page (plan 100) must translate through
 * `useUiLanguage`: the lede's element, the images' alt text, the names'
 * labels and the neighbouring tablets' names. Client components only for
 * that; the server renders all of it.
 */

/** The page's opening sentence: the element, holy names and King, or the Union's lines. */
export function TabletLede({
  tablet,
  values,
}: {
  tablet: TabletPageId;
  values: Readonly<Record<string, string>>;
}) {
  const { t } = useUiLanguage();
  // `UiText` marks a translation's language, as the page's other text is.
  return tablet === "union" ? (
    <UiText message={TABLET_LEDE.union} values={{ ...values }} />
  ) : (
    <UiText
      message={TABLET_LEDE.watchtower}
      values={{ ...values, element: t(ELEMENT_WORDS[tablet] ?? tablet) }}
    />
  );
}

/**
 * A tablet's static PNG under the page, which the structured data names.
 * Black on white, so on a light card in the dark scheme (plan 076).
 */
export function TabletImage({
  tablet,
  drawing,
  png,
  lines,
  lazy = false,
}: {
  tablet: TabletPageId;
  drawing: "flat" | "pyramids";
  png: TabletPngFile;
  /** The Union's four lines, which its alt text gives. */
  lines: Readonly<Record<string, string>>;
  /** Loaded as it nears the screen: the pyramids, further down. */
  lazy?: boolean;
}) {
  const { t } = useUiLanguage();
  return (
    // A plain image: the file is static and sized already, as the
    // kameas' squares and the halls' drawings are.
    // biome-ignore lint/performance/noImgElement: see above
    <img
      src={png.path}
      width={png.width}
      height={png.height}
      alt={tabletAlt(tablet, drawing, lines, t)}
      loading={lazy ? "lazy" : undefined}
      className={`${tablet === "union" ? styles.union : styles.watchtower} ${plateClass}`}
    />
  );
}

/** A name in the list: what its label needs, its spelling, its entry. */
export interface ListedName
  extends Pick<TabletName, "id" | "kind" | "attribution"> {
  /** As the tool's list shows it: "Bataivah". */
  shown: string;
  /** Its dictionary entry, where it has one. */
  href?: string;
}

/**
 * The names read off the tablet in the Golden Dawn's version, grouped as
 * the tool groups them, each with its role and, where it has one, its
 * dictionary entry. A static list: the tool's `NamesPanel` is the
 * interactive one.
 */
export function TabletNameList({
  tablet,
  groups,
}: {
  tablet: TabletPageId;
  groups: readonly { key: GroupKey; names: readonly ListedName[] }[];
}) {
  const { t } = useUiLanguage();
  return (
    <div className={styles.groups}>
      {groups.map(({ key, names }) => (
        <section key={key} aria-labelledby={`names-${key}`}>
          <h3 id={`names-${key}`}>
            {groupLabel(
              key === "cross" || key === "union" ? undefined : key,
              tablet,
              "gd",
              t,
            )}
          </h3>
          <ul className={styles.names}>
            {names.map((name) => (
              <li key={name.id} data-name={name.id}>
                {name.href ? (
                  <Link href={name.href} className={styles.name}>
                    {name.shown}
                  </Link>
                ) : (
                  <span className={styles.name}>{name.shown}</span>
                )}{" "}
                <span className={styles.role}>{nameLabel(name, "gd", t)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The tablets before and after this one, as the entity pages close. */
export function TabletPrevNext({
  prev,
  next,
}: {
  prev?: TabletPageId;
  next?: TabletPageId;
}) {
  const { t } = useUiLanguage();
  const neighbour = (id?: TabletPageId) =>
    id && { href: tabletPath(id), label: t(TABLET_PAGE_LABELS[id]) };
  return (
    <PrevNext
      label={t(/*i18n*/ "The Enochian tablets")}
      prev={neighbour(prev)}
      next={neighbour(next)}
    />
  );
}
