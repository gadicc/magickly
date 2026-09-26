import Link from "@magick-components/Link";
import type { PlanetRow } from "@magick-data/rows";
import { Fragment } from "react";
import { chaldean } from "@/app/astrology/planetary-hours/utils";
import PlanetarySpirit from "@/components/astrology/planetarySpirits";
import {
  EntityFrame,
  EntityTable,
  Hebrew,
  Lede,
  Muted,
  Name,
  Row,
  Trail,
} from "@/components/entity";
import { RWSName } from "@/tarot";
import styles from "./planet.module.css";

/** The spirits and intelligences are ids, in lower case, with no table yet. */
function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * Uranus, Neptune and the two nodes carry a name and a symbol and nothing
 * else, since the classical attributions end with the seven planets; their
 * page says so rather than showing a table of one row without a word.
 */
function hasOnlyItsSymbol(planet: PlanetRow) {
  return !(
    planet.name.he ||
    planet.hebrewLetter ||
    planet.sephirot.length ||
    planet.godName ||
    planet.archangel ||
    planet.intelligenceId ||
    planet.spiritId ||
    planet.zodiacs.length ||
    planet.tetragrams.length ||
    planet.gdGrade ||
    planet.alchemySymbol ||
    planet.magickTypes
  );
}

/** "in Hebrew שמש, Shemesh, “Sun”", after whatever the lede leads with. */
function inHebrew(he: NonNullable<PlanetRow["name"]["he"]>) {
  return (
    <>
      <Hebrew>{he.he}</Hebrew>, <span lang="he-Latn">{he.roman}</span>
      {he.en ? <>, “{he.en}”</> : null}
    </>
  );
}

/** The sephirot, each linked to its page, as a list in running text. */
function sephirotOf(planet: PlanetRow, separator: string) {
  return planet.sephirot.map((sephirah, i) => (
    <Fragment key={sephirah.id}>
      {i ? separator : null}
      <Link href={`/kabbalah/sephirah/${sephirah.id}`}>
        {sephirah.name.roman}
      </Link>
    </Fragment>
  ));
}

function PlanetLede({ planet }: { planet: PlanetRow }) {
  const he = planet.name.he;
  if (planet.kind === "sphere")
    return (
      <Lede>
        The sphere of {sephirotOf(planet, " and ")}
        {he ? <>, in Hebrew {inHebrew(he)}</> : null}.
      </Lede>
    );
  if (he) return <Lede>In Hebrew {inHebrew(he)}.</Lede>;
  if (hasOnlyItsSymbol(planet))
    return (
      <Lede>
        The classical correspondences stop at Saturn, the last of the seven
        planets of antiquity, so this page has only its symbol.
      </Lede>
    );
  // Earth, which has no Hebrew name but does have its grade.
  return null;
}

/**
 * A planet's correspondences, or a sphere's (plan 036, "Planet"). The table
 * also holds the three spheres the sephirot name as their planet,
 * `primum-mobile`, `zodiac` and `olam-yesodot`, which carry a name and
 * nothing else, so a sphere's page is its lede. No planet is in a chain, so
 * there are no arrows and no nav.
 *
 * Synchronous, so that `renderToString` can render it; the route looks the
 * row up and hands it over.
 */
export default function PlanetPage({ planet }: { planet: PlanetRow }) {
  const letter = planet.hebrewLetter;
  const path = letter?.hermeticPath;
  const metal = planet.alchemySymbol;
  const grade = planet.gdGrade;

  return (
    <EntityFrame>
      <Trail href="/astrology/planets">Planets</Trail>

      <h1>
        {planet.name.en.en}
        {planet.symbol ? ` ${planet.symbol}` : null}
      </h1>

      <PlanetLede planet={planet} />

      {/* A sphere has nothing for the table: its sephirah is in the lede. */}
      {planet.kind === "sphere" ? null : (
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
          <Row label="Sephirah">{sephirotOf(planet, ", ")}</Row>
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
            {planet.intelligenceId ? capitalize(planet.intelligenceId) : null}
          </Row>
          <Row label="Spirit">
            {planet.spiritId ? (
              <>
                {capitalize(planet.spiritId)}{" "}
                {/* The component spreads its other props into its style. The
                    sigil is decoration beside the name it draws. */}
                <PlanetarySpirit
                  id={planet.spiritId}
                  aria-hidden
                  height="1.5em"
                  display="inline-block"
                  verticalAlign="middle"
                />
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
          <Row label="Magical operations">
            {planet.magickTypes ? (
              <>
                {planet.magickTypes.en}{" "}
                {/* Decision 3: shown, and marked, until its source is named. */}
                <Muted block>
                  An editorial summary; its source is not recorded.
                </Muted>
              </>
            ) : null}
          </Row>
        </EntityTable>
      )}

      {/* The hours are the seven planets' of the Chaldean order, no others. */}
      {chaldean.includes(planet.id) ? (
        <p className={styles.seeAlso}>
          See also:{" "}
          <Link href="/astrology/planetary-hours">Planetary hours</Link>
        </p>
      ) : null}
    </EntityFrame>
  );
}
