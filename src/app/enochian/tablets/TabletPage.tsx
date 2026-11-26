import { TABLET_QUARTERS } from "magick-data/enochian/tabletNames";
import { H2 } from "@/app/PageText";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import JsonLd from "@/seo/JsonLd";
import { tabletFiles, tabletJsonLd } from "@/seo/tablets";
import Cite from "@/sources/Cite";
import { EntityFrame, Lede } from "@/ui/entity";
import Link from "@/ui/Link";
import { dictionaryHref, linkedHeadword } from "./dictionaryLinks";
import { TABLET_NAME_LINKS } from "./nameLinks";
import { displayName, type GroupKey, groupOf } from "./nameWords";
import { Sources } from "./Sources";
import {
  type ListedName,
  TabletImage,
  TabletLede,
  TabletNameList,
  TabletPrevNext,
} from "./TabletFigures";
import styles from "./tabletPage.module.css";
import {
  gdNames,
  tabletLedeValues,
  tabletNote,
  tabletSquareCount,
  versionCounts,
} from "./tabletPageData";
import {
  TABLETS_HUB_PATH,
  type TabletPageId,
  tabletNeighbours,
  tabletToolHref,
} from "./tabletPages";

/** The names' groups, as the tool's Names tab groups them. */
function nameGroups(tablet: TabletPageId) {
  const names = gdNames(tablet);
  const keys: GroupKey[] =
    tablet === "union" ? ["union"] : ["cross", ...TABLET_QUARTERS];
  return keys.map((key) => ({
    key,
    names: names
      .filter((name) => groupOf(name) === key)
      .map((name): ListedName => {
        // Resolved here: the dictionary's map is server-only (`nameLinks.ts`).
        const headword = linkedHeadword(
          TABLET_NAME_LINKS,
          tablet,
          "gd",
          name.id,
        );
        return {
          id: name.id,
          kind: name.kind,
          ...(name.attribution && { attribution: name.attribution }),
          shown: displayName(name.spelling),
          ...(headword && { href: dictionaryHref(headword) }),
        };
      }),
  }));
}

/**
 * One tablet's page (plan 100): what it is, with its holy names and King
 * or its lines, and its note; the tablet in the Golden Dawn's version,
 * with how many squares each other version reads otherwise; its names,
 * each linked to its dictionary entry; the tablet as pyramids; its
 * sources; and its neighbours. Built from magick-data, server rendered;
 * `TabletFigures` translates what must be. The app bar heads it ("Fire
 * Tablet", `pathnames.ts`), so its own headings start at h2.
 */
export default function TabletPage({ tablet }: { tablet: TabletPageId }) {
  const files = tabletFiles(tablet);
  const values = tabletLedeValues(tablet);
  const note = tabletNote(tablet);
  const { prev, next } = tabletNeighbours(tablet);
  const counts = versionCounts(tablet);

  return (
    <EntityFrame>
      {/* The tablet's four files; the trail is the route's own script. */}
      <JsonLd data={tabletJsonLd(tablet)} />

      <Lede>
        <TabletLede tablet={tablet} values={values} />
      </Lede>
      <p className={styles.prose}>{note.text}</p>

      <figure className={styles.figure}>
        <TabletImage
          tablet={tablet}
          drawing="flat"
          png={files.flat.png}
          lines={values}
        />
        <figcaption>
          <UiRichText
            message={
              /*i18n*/ "The tablet in the Golden Dawn's version, the default. <0>Open it in the tablets tool</0> for the other versions, the Enochian letters, the names on the tablet and their squares."
            }
            components={{ 0: <Link href={tabletToolHref(tablet, "tablet")} /> }}
          />
          <span className={styles.downloads}>
            {/* A file, not a page: nothing to prefetch. */}
            <Link
              href={files.flat.svg.path}
              download={files.flat.svg.name}
              prefetch={false}
            >
              <UiText message={/*i18n*/ "Download the tablet as SVG"} />
            </Link>
          </span>
        </figcaption>
      </figure>

      {/* Left out where no version differs: the Union's. */}
      {counts.some((count) => count.squares > 0) ? (
        <>
          <p className={styles.prose}>
            <UiRichText
              message={
                /*i18n*/ "How many of its {count} squares each other version reads otherwise, by a letter, u for v or a square left empty, case aside; the tool's <0>Differences</0> show each one:"
              }
              values={{ count: tabletSquareCount(tablet) }}
              components={{
                0: <Link href={tabletToolHref(tablet, "differences")} />,
              }}
            />
          </p>
          <ul className={styles.counts}>
            {counts.map((count) => (
              <li key={count.version} data-version={count.version}>
                {count.title}: {count.squares}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <section aria-labelledby="names">
        <H2 id="names">
          <UiText message={/*i18n*/ "Names on the tablet"} />
        </H2>
        <p className={styles.prose}>
          <UiRichText
            message={
              /*i18n*/ "The names read off the tablet in the Golden Dawn's version, grouped as it is built, each linked to its dictionary entry where it has one. <0>Choose a name in the tablets tool</0> to see its squares and how the other versions spell it."
            }
            components={{
              0: <Link href={tabletToolHref(tablet, "tablet")} />,
            }}
          />
        </p>
        <TabletNameList tablet={tablet} groups={nameGroups(tablet)} />
      </section>

      <section aria-labelledby="pyramids">
        <H2 id="pyramids">
          <UiText message={/*i18n*/ "The tablet as pyramids"} />
        </H2>
        <figure className={styles.figure}>
          <TabletImage
            tablet={tablet}
            drawing="pyramids"
            png={files.pyramids.png}
            lines={values}
            lazy
          />
          <figcaption>
            <UiRichText
              message={
                /*i18n*/ "Every square drawn as the Golden Dawn's truncated pyramid, its sides in their elements' colours (<0>The Golden Dawn</0>, vol. 4, p. <1>295</1>), each symbol standing on its side's outer edge, as Regardie's drawings have them (pp. <2>294</2> and <3>296</3>). <4>How the pyramids are read</4>, and <5>the same drawing in the tablets tool</5>."
              }
              components={{
                0: <i />,
                1: (
                  <Cite work="regardie1940" leaf={287} plain rel="noreferrer" />
                ),
                2: (
                  <Cite work="regardie1940" leaf={286} plain rel="noreferrer" />
                ),
                3: (
                  <Cite work="regardie1940" leaf={288} plain rel="noreferrer" />
                ),
                4: <Link href={`${TABLETS_HUB_PATH}#tablets-pyramids`} />,
                5: <Link href={tabletToolHref(tablet, "pyramids")} />,
              }}
            />
            <span className={styles.downloads}>
              <Link
                href={files.pyramids.svg.path}
                download={files.pyramids.svg.name}
                prefetch={false}
              >
                <UiText message={/*i18n*/ "Download the pyramids as SVG"} />
              </Link>
            </span>
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="sources">
        <H2 id="sources">
          <UiText message={/*i18n*/ "Sources"} />
        </H2>
        <Sources sources={note.sources} />
      </section>

      <TabletPrevNext prev={prev} next={next} />
    </EntityFrame>
  );
}
