import MuiLink from "@mui/material/Link";
import PlanetarySpirit from "magick-components/astrology/planetarySpirits";
import { dayOf } from "magick-components/astrology/planetDays";
import { planetName } from "magick-components/astrology/planetName";
import Data from "magick-data";
import type { PlanetRow } from "magick-data/rows";
import { Fragment } from "react";
import { chaldean } from "@/app/astrology/planetary-hours/utils";
import Ink from "@/drawings/Ink";
import {
  HEYDON_PAGES,
  HeydonCitation,
  rulerSigilPage,
} from "@/drawings/sigilSources";
import { Breadcrumbs, entityTrail } from "@/seo/Breadcrumbs";
import { RWSName } from "@/tarot";
import {
  EntityFrame,
  EntityTable,
  glossBeside,
  Hebrew,
  Lede,
  Muted,
  Name,
  Row,
  Trail,
} from "@/ui/entity";
import Link from "@/ui/Link";
import { Intelligence, IntelligenceNotes } from "../Intelligence";
import styles from "./planet.module.css";

/** The spirits are ids, in lower case, with no table yet. */
function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

/** Where the spirit's sigil is drawn from: Heydon's page, linked to its scan. */
function SigilSource({ spiritId }: { spiritId: string }) {
  const page = rulerSigilPage(spiritId);
  if (!page) return null;
  return (
    <Muted block>
      Sigil after{" "}
      <MuiLink href={HEYDON_PAGES[page].url}>
        <HeydonCitation page={page} />
      </MuiLink>
      .
    </Muted>
  );
}

/**
 * "in Hebrew לבנה, Levanah, “White”", after whatever the lede leads with;
 * the gloss is left out where it only repeats the heading, as the zodiac's
 * and Sol's would.
 */
function inHebrew(planet: PlanetRow) {
  const he = planet.name.he;
  if (!he) return null;
  // Beside the heading's common name too: Sol's “Sun” is already there.
  const meaning = glossBeside(planet.commonName ?? planet.name.en.en, he.en);
  return (
    <>
      <Hebrew>{he.he}</Hebrew>, <span lang="he-Latn">{he.roman}</span>
      {meaning ? <>, “{meaning}”</> : null}
    </>
  );
}

/** The sephirot, each linked to its page, as a list in running text. */
function sephirotOf(planet: PlanetRow) {
  return planet.sephirot.map((sephirah, i) => (
    <Fragment key={sephirah.id}>
      {i ? ", " : null}
      <Link href={`/kabbalah/sephirah/${sephirah.id}`}>
        {sephirah.name.roman}
      </Link>
    </Fragment>
  ));
}

/**
 * A row's own text where it has one (plan 078): Earth, the moderns, the
 * nodes and the spheres. Otherwise the seven planets' Hebrew names.
 */
function PlanetLede({ planet }: { planet: PlanetRow }) {
  if (planet.about) return <Lede>{planet.about.en}</Lede>;
  if (planet.name.he) return <Lede>In Hebrew {inHebrew(planet)}.</Lede>;
  return null;
}

interface SeeAlso {
  href: string;
  text: string;
}

const planetLink = (planet: PlanetRow): SeeAlso => ({
  href: `/astrology/planet/${planet.id}`,
  text: planetName(planet),
});

const FIGURES: SeeAlso = {
  href: "/geomancy/reference",
  text: "Geomantic figures",
};

/**
 * The pages a row's `about` names, linked under it, named as their own
 * pages name them where they have a row.
 */
const SEE_ALSO: Partial<Record<string, SeeAlso[]>> = {
  earth: [
    {
      href: "/kabbalah/sephirah/malchut",
      text: Data.sephirah.malchut.name.roman,
    },
    { href: "/gd/grade/1=10", text: Data.gdGrade["1=10"].name },
    planetLink(Data.planet["olam-yesodot"]),
    { href: "/enochian/tablets", text: "Enochian tablets" },
  ],
  rahu: [planetLink(Data.planet.ketu), FIGURES],
  ketu: [planetLink(Data.planet.rahu), FIGURES],
};

/** The hours are the seven planets' of the Chaldean order, no others. */
function seeAlsoOf(planet: PlanetRow): SeeAlso[] {
  return [
    ...(chaldean.includes(planet.id)
      ? [{ href: "/astrology/planetary-hours", text: "Planetary hours" }]
      : []),
    ...(SEE_ALSO[planet.id] ?? []),
  ];
}

/**
 * The ten heavens, one to each sephirah from Keter to Malchut, after
 * Mathers (1887); Da'at has none.
 */
const HEAVENS = Object.values(Data.sephirah)
  .flatMap((sephirah) =>
    sephirah.planet ? [{ sephirah, heaven: sephirah.planet }] : [],
  )
  .sort((a, b) => a.sephirah.index - b.sephirah.index);

/**
 * The ten heavens, on the spheres' pages, each linked but this page's own.
 * The symbols take a column of their own on the left, empty for a sphere,
 * so that the names line up.
 */
function TenHeavens({ current }: { current: string }) {
  return (
    <section aria-labelledby="ten-heavens">
      <h2 id="ten-heavens">The ten heavens</h2>
      <table className={styles.heavens} aria-labelledby="ten-heavens">
        <thead>
          <tr>
            <th scope="col">Heaven</th>
            <th scope="col">Sephirah</th>
          </tr>
        </thead>
        <tbody>
          {HEAVENS.map(({ sephirah, heaven }) => (
            <tr key={sephirah.id}>
              <th scope="row">
                <span className={styles.symbol} aria-hidden="true">
                  {heaven.symbol}
                </span>
                {heaven.id === current ? (
                  <span aria-current="page">{planetName(heaven)}</span>
                ) : (
                  <Link href={`/astrology/planet/${heaven.id}`}>
                    {planetName(heaven)}
                  </Link>
                )}
                {/* Each heaven's Hebrew name, the sphere's own among them,
                    under its English, in line with the name. */}
                {heaven.name.he ? (
                  <span className={styles.hebrew}>
                    <Hebrew>{heaven.name.he.he}</Hebrew>{" "}
                    <span lang="he-Latn">{heaven.name.he.roman}</span>
                  </span>
                ) : null}
              </th>
              <td>
                <Link href={`/kabbalah/sephirah/${sephirah.id}`}>
                  {sephirah.name.roman}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * A planet's correspondences, or a sphere's (plan 036, "Planet"). The table
 * also holds the three spheres the sephirot name as their planet,
 * `primum-mobile`, `zodiac` and `olam-yesodot`, which carry a name and a
 * text and no correspondences, so a sphere's page is its lede and the ten
 * heavens. No planet is in a chain, so there are no arrows and no nav.
 *
 * Synchronous, so that `renderToString` can render it; the route looks the
 * row up and hands it over.
 */
export default function PlanetPage({ planet }: { planet: PlanetRow }) {
  const letter = planet.hebrewLetter;
  const path = letter?.hermeticPath;
  const metal = planet.alchemySymbol;
  const grade = planet.gdGrade;
  const name = planetName(planet);
  const seeAlso = seeAlsoOf(planet);

  return (
    <EntityFrame>
      <Trail href="/astrology/planets">Planets</Trail>
      <Breadcrumbs
        trail={entityTrail(
          "/astrology/planets",
          name,
          `/astrology/planet/${planet.id}`,
        )}
      />

      <h1>
        {name}
        {planet.symbol ? ` ${planet.symbol}` : null}
      </h1>

      <PlanetLede planet={planet} />

      {/* A sphere has nothing for the table: its sephirah is in the list. */}
      {planet.kind === "sphere" ? (
        <TenHeavens current={planet.id} />
      ) : (
        <EntityTable>
          <Row label="Symbol">
            {planet.symbol ? (
              <>
                {planet.symbol}
                {metal ? (
                  <>
                    {" · alchemical "}
                    {metal.symbol} {metal.name.en}
                  </>
                ) : null}
              </>
            ) : null}
          </Row>
          {/* The day the planet rules, for the seven the hours count. */}
          <Row label="Day">{dayOf(planet.id)}</Row>
          <Row label="Hebrew letter">
            {letter ? (
              <>
                <Hebrew>{letter.letter.he}</Hebrew>{" "}
                <span lang="he-Latn">{letter.letter.name}</span> ·{" "}
                {letter.value} · “{letter.meaning.en}”
              </>
            ) : null}
          </Row>
          <Row label="Path">
            {path?.hermetic ? (
              <Link href={`/kabbalah/path/${path.id}`}>
                {path.hermetic.pathNo}, {path.from.name.roman} –{" "}
                {path.to.name.roman}, {RWSName(path.hermetic.tarotId)}
              </Link>
            ) : null}
          </Row>
          <Row label="Sephirah">{sephirotOf(planet)}</Row>
          <Row label="God name">
            {planet.godName ? (
              <Name
                original={planet.godName.name.he}
                roman={planet.godName.name.roman}
                meaning={planet.godName.name.en}
              />
            ) : null}
          </Row>
          <Row label="Archangel">
            {planet.archangel ? (
              // Gabriel's `name.en` is the English form of the name, not a
              // meaning, so it is not given as one, as on the sephirah page.
              <Name
                original={planet.archangel.name.he}
                roman={planet.archangel.name.roman}
              />
            ) : null}
          </Row>
          <Row label="Intelligence">
            {planet.intelligenceId ? (
              <Intelligence planet={planet} hebrew />
            ) : null}
          </Row>
          <Row label="Spirit">
            {planet.spiritId ? (
              <>
                {capitalize(planet.spiritId)}{" "}
                {/* The component spreads its other props into its style. The
                    sigil is decoration beside the name it draws. */}
                <Ink drawing="spirit">
                  <PlanetarySpirit
                    id={planet.spiritId}
                    aria-hidden
                    height="1.5em"
                    display="inline-block"
                    verticalAlign="middle"
                  />
                </Ink>
                <SigilSource spiritId={planet.spiritId} />
              </>
            ) : null}
          </Row>
          <Row label="Rules">
            {planet.zodiacs
              .map((sign) => `${sign.symbol} ${sign.name.en}`)
              .join(", ")}
          </Row>
          <Row label="Geomantic figures">
            {/* The reference has no anchor per figure yet (plan 036, deferred). */}
            {planet.tetragrams.length ? (
              <Link href="/geomancy/reference">
                {planet.tetragrams.map((figure) => figure.title.en).join(", ")}
              </Link>
            ) : null}
          </Row>
          <Row label="Grade">
            {grade ? (
              <Link href={`/gd/grade/${grade.id}`}>
                {grade.id} {grade.name}
              </Link>
            ) : null}
          </Row>
          <Row label="Key of Solomon">
            {planet.keyOfSolomon ? (
              <>
                “{planet.keyOfSolomon.en}”{" "}
                <Muted block>
                  Mathers' translation (1888), Book I, chapter II.
                </Muted>
              </>
            ) : null}
          </Row>
        </EntityTable>
      )}

      {seeAlso.length ? (
        <p className={styles.seeAlso}>
          See also:{" "}
          {seeAlso.map((link, i) => (
            <Fragment key={link.href}>
              {i ? ", " : null}
              <Link href={link.href}>{link.text}</Link>
            </Fragment>
          ))}
        </p>
      ) : null}

      {/* The Moon's two intelligences have a note each, at the foot. */}
      <IntelligenceNotes planet={planet} />
    </EntityFrame>
  );
}
