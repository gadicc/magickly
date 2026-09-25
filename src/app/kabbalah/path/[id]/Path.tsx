import Link from "@magick-components/Link";
import Image from "next/image";
import type { HebrewLetterRow, TolPathRow } from "@/../data/rows";
import {
  EntityFrame,
  EntityTable,
  FigureNav,
  Hebrew,
  Lede,
  type Neighbour,
  PrevNext,
  Row,
  Trail,
} from "@/components/entity";
import TreeOfLife from "@/components/kabbalah/TreeOfLife";
import { RWSName, RWSPath, trumpNumeral } from "@/tarot";
import styles from "./path.module.css";

/**
 * One path of the Tree of Life, server-rendered, with what each of the two
 * attributions puts on it (plan 036).
 *
 * The two trees share the path's row and its pair of sephirot; what differs
 * is the letter on it and whether the tree draws it at all. The Hermetic tree
 * numbers its paths and gives each a trump, and omits `2_5` and `3_4`; the
 * Hebrew tree has those two and omits `7_10` and `8_10`. So a path's page has
 * a section for each tree that draws it, and says which one does not.
 */

/**
 * How a path is headed, here and where its neighbours name it: "Path 13:
 * Keter – Tiferet" with the Hermetic number, or "Path Chochmah – Gevurah" for
 * the two the Hermetic tree does not number.
 */
function headingOf(path: TolPathRow) {
  const pair = `${path.from.name.roman} – ${path.to.name.roman}`;
  return path.hermetic
    ? `Path ${path.hermetic.pathNo}: ${pair}`
    : `Path ${pair}`;
}

function neighbour(path: TolPathRow | undefined): Neighbour | undefined {
  return path && { href: `/kabbalah/path/${path.id}`, label: headingOf(path) };
}

/**
 * A letter as the page has always shown one: the letter large in a box, and
 * under it its name, its value and its meaning.
 */
function Letter({ letter }: { letter: HebrewLetterRow }) {
  return (
    <div className={styles.letter}>
      <div className={styles.glyph}>
        <Hebrew>{letter.letter.he}</Hebrew>
      </div>
      <div>
        <span lang="he-Latn">{letter.letter.name}</span>
        {` · ${letter.value} · “${letter.meaning.en}”`}
      </div>
    </div>
  );
}

/** The page body. Synchronous, so that `renderToString` can render it. */
export default function Path({ path }: { path: TolPathRow }) {
  const { hermetic, hebrew } = path;
  // Named as the Rider–Waite card beside it prints it.
  const trump = hermetic && RWSName(hermetic.tarotId);
  // Only the seven double letters carry a planet, and the attributions the
  // data gives them are the Hermetic tree's, so the Hebrew block has none.
  const planet = hermetic?.hebrewLetter.planet;
  const prev = neighbour(path.prev);
  const next = neighbour(path.next);

  return (
    <EntityFrame>
      <Trail href="/kabbalah/tree">Tree of Life</Trail>

      <FigureNav prev={prev} next={next}>
        {/* Drawn on the tree the path belongs to, so that it is on it.
            `flip` is passed because the Tree appends `flip && …` to its
            stylesheet, which writes "undefined" there when it is left out. */}
        <TreeOfLife
          height="150px"
          topText=""
          activePath={path.id}
          letterAttr={hermetic ? "hermetic" : "hebrew"}
          flip={false}
        />
      </FigureNav>

      <h1>{headingOf(path)}</h1>

      <Lede>
        Joins{" "}
        <Link href={`/kabbalah/sephirah/${path.from.id}`}>
          {path.from.name.roman}
        </Link>{" "}
        and{" "}
        <Link href={`/kabbalah/sephirah/${path.to.id}`}>
          {path.to.name.roman}
        </Link>
        {hermetic ? "." : "; the Hermetic tree does not draw it."}
      </Lede>

      {hermetic ? (
        <section>
          <h2>Hermetic tree</h2>
          <EntityTable>
            <Row label="Letter">
              <Letter letter={hermetic.hebrewLetter} />
            </Row>
            <Row label="Tarot">
              <Image
                className={styles.trump}
                src={RWSPath(hermetic.tarotId)}
                alt={trump}
                width={100}
                height={176}
              />
              {`${trump} (${trumpNumeral(hermetic.tarotId)})`}
            </Row>
            <Row label="Planet">
              {planet ? (
                <Link href={`/astrology/planet/${planet.id}`}>
                  {`${planet.symbol} ${planet.name.en.en}`}
                </Link>
              ) : null}
            </Row>
          </EntityTable>
          {hebrew ? null : <p>The Hebrew tree does not draw this path.</p>}
        </section>
      ) : null}

      {hebrew ? (
        <section>
          <h2>Hebrew tree</h2>
          <EntityTable>
            <Row label="Letter">
              <Letter letter={hebrew.hebrewLetter} />
            </Row>
          </EntityTable>
        </section>
      ) : null}

      <PrevNext label="Paths" prev={prev} next={next} />
    </EntityFrame>
  );
}
