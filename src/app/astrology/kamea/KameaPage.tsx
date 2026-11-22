import type { ReactNode } from "react";
import { H2 } from "@/app/PageText";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import { gdHallShortName } from "@/render/contracts/gdHall";
import JsonLd from "@/seo/JsonLd";
import { kameaFiles, kameaJsonLd } from "@/seo/kameas";
import { EntityFrame, Lede } from "@/ui/entity";
import Link from "@/ui/Link";
import { hallsDrawing } from "./halls";
import { KameaPrevNext, KameaSeal, KameaSquare } from "./KameaFigures";
import styles from "./kamea.module.css";
import {
  AS_PRINTED_MESSAGE,
  CONSTRUCTION_MESSAGES,
  CORRECTED_MESSAGE,
  CORRECTED_PLANETS,
  IN_PRINT_MESSAGES,
  KAMEA_LEDE_MESSAGE,
  MOON_COLUMN_MESSAGE,
  MOON_NAMES_MESSAGE,
  SQUARE_NOTES,
} from "./kameaCopy";
import {
  AGRIPPA_SQUARE_LEAVES,
  KAMEA_HUB_PATH,
  KAMEA_SQUARE_LABELS,
  type KameaPlanetId,
  kameaConstants,
  kameaConstruction,
  kameaNeighbours,
  kameaPath,
  REGARDIE_SQUARE_LEAVES,
} from "./kameaPlanets";
import { LeafLink } from "./LeafLinks";
import NamesTable from "./NamesTable";
import { planetaryNamesOf } from "./planetaryNames";
import { AGRIPPA_LEAF_PAGES, leafRef, WITNESS_ITEMS } from "./witnesses";

/** The halls that draw a square, read off their presets (`halls.ts`). */
export { hallsDrawing };

/** Text linked to archive.org's view of a leaf, or our mirror of it. */
function Leaf({
  item,
  leaf,
  region,
  children,
}: {
  item: string;
  leaf: number;
  region?: string;
  children?: ReactNode;
}) {
  return <LeafLink leaf={leafRef(item, leaf, region)}>{children}</LeafLink>;
}

/** An outside link, as the page's other outside links are drawn. */
function Outside({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} rel="noopener">
      {children}
    </Link>
  );
}

/** Regardie's vol. 4: the method of tracing a name on pp. 78–80. */
const regardie = (leaf: number) =>
  leafRef(WITNESS_ITEMS.regardie1940, leaf).href;

/**
 * One planet's kamea (plan 093, K4): the square, large, with its numbers
 * and how it is made; where it is printed and how the printings differ;
 * its names by witness; its seal; on the Moon's, the note on the column;
 * and the pages it belongs with. The app bar heads it ("Kamea of
 * Saturn", `pathnames.ts`), so its own headings start at h2.
 */
export default function KameaPage({ planet }: { planet: KameaPlanetId }) {
  const constants = kameaConstants(planet);
  const { order, cells, line, total } = constants;
  const files = kameaFiles(planet);
  const agrippa = AGRIPPA_SQUARE_LEAVES[planet];
  const construction = kameaConstruction(planet);
  const notes = SQUARE_NOTES[planet];
  const names = planetaryNamesOf(planet);
  const halls = hallsDrawing(planet);
  const { prev, next } = kameaNeighbours(planet);
  const squareRegion = `${planet}Square`;

  return (
    <EntityFrame>
      {/* The square's two files; the trail is the route's own script. */}
      <JsonLd data={kameaJsonLd(planet)} />

      <Lede>
        <UiRichText
          message={KAMEA_LEDE_MESSAGE}
          values={{ order, cells, line, total }}
        />
      </Lede>

      <KameaSquare
        planet={planet}
        constants={constants}
        png={files.png}
        svg={files.svg}
      />

      <dl className={styles.facts}>
        <dt>
          <UiText message={/*i18n*/ "Order"} />
        </dt>
        <dd>
          {order} × {order}
        </dd>
        <dt>
          <UiText message={/*i18n*/ "Numbers"} />
        </dt>
        <dd>1–{cells}</dd>
        <dt>
          <UiText message={/*i18n*/ "Each line"} />
        </dt>
        <dd>{line}</dd>
        <dt>
          <UiText message={/*i18n*/ "The whole square"} />
        </dt>
        <dd>{total}</dd>
      </dl>

      <section aria-labelledby="construction">
        <H2 id="construction">
          <UiText message={/*i18n*/ "How the square is made"} />
        </H2>
        <p>
          <UiRichText
            message={CONSTRUCTION_MESSAGES[construction]}
            values={{ cells, complement: cells + 1 }}
          />
        </p>
      </section>

      <section aria-labelledby="in-print">
        <H2 id="in-print">
          <UiText message={/*i18n*/ "The square in print"} />
        </H2>
        <p>
          <UiRichText
            message={IN_PRINT_MESSAGES[planet]}
            values={{
              page: agrippa.page,
              regardiePage: REGARDIE_SQUARE_LEAVES[planet] + 6,
            }}
            components={{
              0: <i />,
              1: (
                <Leaf
                  item={WITNESS_ITEMS.agrippa1533}
                  leaf={agrippa.leaf}
                  region={squareRegion}
                />
              ),
              2: <i />,
              3: <Outside href={regardie(REGARDIE_SQUARE_LEAVES[planet])} />,
            }}
          />{" "}
          <UiText
            message={
              CORRECTED_PLANETS.includes(planet)
                ? CORRECTED_MESSAGE
                : AS_PRINTED_MESSAGE
            }
          />
        </p>
        {notes.length ? (
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note.message}>
                <UiText message={note.message} />{" "}
                <Leaf item={WITNESS_ITEMS[note.witness]} leaf={note.leaf}>
                  <UiText
                    message={/*i18n*/ "page {page}"}
                    values={{
                      page:
                        note.witness === "agrippa1533"
                          ? (AGRIPPA_LEAF_PAGES[note.leaf] ?? "")
                          : note.leaf + 6,
                    }}
                  />
                </Leaf>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="names">
        <H2 id="names">
          <UiText message={/*i18n*/ "The names of the square"} />
        </H2>
        <p>
          <UiRichText
            message={
              /*i18n*/ "Agrippa gives each square names whose letters add up to one of its numbers: its order, its count of cells, the sum of a line or the sum of the whole. The divine names come first, then the intelligence and the spirit. The Hebrew is Agrippa's of 1533, the spelling this site traces; under each name is every witness's reading, linked to its page, with its own spelling where it differs. A name with a page of its own has its sigil there, traced on this square."
            }
          />
        </p>
        {planet === "luna" ? (
          <p>
            <UiRichText message={MOON_NAMES_MESSAGE} />
          </p>
        ) : null}
        <NamesTable names={names} planet={planet} labelledBy="names" />
      </section>

      <section aria-labelledby="seal">
        <H2 id="seal">
          <UiText message={/*i18n*/ "The seal"} />
        </H2>
        <KameaSeal planet={planet} />
        <p>
          <UiRichText
            message={
              /*i18n*/ "The planet's seal, after Agrippa's woodcut on <0>page {page}</0> of the 1533 printing: our own drawing of its lines, not a copy of the print. Regardie describes a planet's seal as a figure drawn so as to touch each of the square's numbers (<1>page 80</1>)."
            }
            values={{ page: agrippa.page }}
            components={{
              0: (
                <Leaf
                  item={WITNESS_ITEMS.agrippa1533}
                  leaf={agrippa.leaf}
                  region={squareRegion}
                />
              ),
              1: <Outside href={regardie(74)} />,
            }}
          />
        </p>
      </section>

      {planet === "luna" ? (
        <section aria-labelledby="column">
          <H2 id="column">
            <UiText message={/*i18n*/ "The Moon's column"} />
          </H2>
          <p>
            <UiRichText
              message={MOON_COLUMN_MESSAGE}
              components={{
                0: <Link href={`${KAMEA_HUB_PATH}/sigils?planet=luna`} />,
              }}
            />
          </p>
        </section>
      ) : null}

      <section aria-labelledby="see-also">
        <H2 id="see-also">
          <UiText message={/*i18n*/ "See also"} />
        </H2>
        <ul className={styles.seeAlso}>
          <li>
            <Link href={`/astrology/planet/${planet}`}>
              <UiText message={/*i18n*/ "The planet's correspondences"} />
            </Link>
          </li>
          {halls.map((hall) => (
            // The hall's name is its link, apart from the sentence, so that
            // a translation need not carry an English name inside its own.
            <li key={hall.slug}>
              <UiText
                message={/*i18n*/ "The temple hall that has this square in it:"}
              />{" "}
              <Link href={`/gd/halls/${hall.slug}`}>
                {gdHallShortName(hall)}
              </Link>
            </li>
          ))}
          <li>
            <UiRichText
              message={
                /*i18n*/ "Trace any Hebrew name on this square in the <0>kamea sigil generator</0>, by the method Regardie sets out in <2>The Golden Dawn</2>, volume 4, on <1>pages 78 to 80</1>."
              }
              components={{
                0: <Link href={`${KAMEA_HUB_PATH}/sigils?planet=${planet}`} />,
                1: <Outside href={regardie(72)} />,
                2: <i />,
              }}
            />
          </li>
          <li>
            <Link href={KAMEA_HUB_PATH}>
              <UiText message={/*i18n*/ "All seven kameas"} />
            </Link>
          </li>
        </ul>
      </section>

      <KameaPrevNext
        prev={
          prev && { href: kameaPath(prev), label: KAMEA_SQUARE_LABELS[prev] }
        }
        next={
          next && { href: kameaPath(next), label: KAMEA_SQUARE_LABELS[next] }
        }
      />
    </EntityFrame>
  );
}
