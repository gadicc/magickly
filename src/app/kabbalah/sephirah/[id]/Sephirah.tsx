import Link from "@magick-components/Link";
import type { SephirahRow, TolPathRow } from "@/../data/rows";
import Chakras from "@/components/chakras/Chakras";
import {
  EntityFrame,
  EntityTable,
  FigureNav,
  Hebrew,
  Lede,
  Muted,
  Name,
  type Neighbour,
  PrevNext,
  Row,
  Trail,
} from "@/components/entity";
import TreeOfLife from "@/components/kabbalah/TreeOfLife";
import { isHiddenSephirah } from "@/seo/entities";
import { RWSName } from "@/tarot";
import styles from "./sephirah.module.css";

/**
 * One sephirah's correspondences, server-rendered (plan 036).
 *
 * The page used to be a client component for the sake of styled-jsx, which
 * shipped the whole barrel to the browser, and printed whatever it did not
 * lay out itself as JSON. It lays out the whole row now, with the four
 * worlds named beside their rows and every value that has a page linked to
 * it, and lists the sphere's paths on both trees.
 */

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

/** The data keeps these in lower case, as slugs are; a row reads as words. */
function capitalise(text: string) {
  return text && text[0].toUpperCase() + text.slice(1);
}

function neighbour(sephirah?: SephirahRow): Neighbour | undefined {
  if (!sephirah) return undefined;
  return {
    href: `/kabbalah/sephirah/${sephirah.id}`,
    label: sephirah.name.roman,
  };
}

/** A world's name beside its row's label, marked as the transliteration it is. */
function World({ children }: { children: string }) {
  return <span lang="he-Latn">{children}</span>;
}

/**
 * One scale's colour, as the page has always drawn it: the web colour behind
 * the scale's name and the colour's. A comma-separated colour is Malchut's
 * quartered disc, drawn as a conic gradient.
 */
function Swatch({
  scale,
  name,
  web,
  text,
}: {
  scale: string;
  name: string;
  web?: string;
  text?: string;
}) {
  return (
    <div
      className={styles.swatch}
      style={{
        background: web?.includes(",") ? `conic-gradient(${web})` : web,
        color: text || "black",
      }}
    >
      <span className={styles.scale}>{scale}</span> {name.split(",").join(", ")}
    </div>
  );
}

/**
 * One path from this sphere: its Hermetic number, the letter it carries on
 * the tree it is drawn on, the sphere at its other end, and its trump.
 */
function PathItem({ path, from }: { path: TolPathRow; from: SephirahRow }) {
  const other = path.fromId === from.id ? path.to : path.from;
  const hermetic = path.hermetic;
  const letter = (hermetic ?? path.hebrew)?.hebrewLetter?.letter;
  return (
    <li>
      {/* The grid sets the number apart and drops the space between; the
          text, which a screen reader and a search engine read, keeps it. */}
      <span className={styles.pathNo}>{hermetic?.pathNo}</span>{" "}
      <span>
        <Link href={`/kabbalah/path/${path.id}`}>
          <Hebrew>{letter?.he}</Hebrew>{" "}
          <span lang="he-Latn">{letter?.name}</span>
        </Link>{" "}
        to{" "}
        <Link href={`/kabbalah/sephirah/${other.id}`}>{other.name.roman}</Link>
        {hermetic ? `, ${RWSName(hermetic.tarotId)}` : null}
        {hermetic && path.hebrew ? null : (
          <Muted>
            {" · "}
            {hermetic ? "Hermetic tree only" : "Hebrew tree only"}
          </Muted>
        )}
      </span>
    </li>
  );
}

/**
 * The page body. Synchronous, so that `renderToString` can render it; the
 * route looks the row up and hands it over.
 */
export default function Sephirah({ sephirah }: { sephirah: SephirahRow }) {
  const { name, color, planet, chakra, soul, gdGrade } = sephirah;
  const hidden = isHiddenSephirah(sephirah);
  const prev = neighbour(sephirah.prev);
  const next = neighbour(sephirah.next);

  // The Hermetic tree's paths in its numbering, then the Hebrew tree's two
  // that the Hermetic one does not draw and so does not number.
  const paths = [...sephirah.pathsFrom, ...sephirah.pathsTo];
  const hermetic = paths
    .filter((path) => path.hermetic)
    .sort((a, b) => (a.hermetic?.pathNo ?? 0) - (b.hermetic?.pathNo ?? 0));
  const hebrewOnly = paths.filter((path) => !path.hermetic);

  return (
    <EntityFrame>
      <Trail href="/kabbalah/tree">Tree of Life</Trail>

      <FigureNav prev={prev} next={next}>
        {/* `flip` is passed because the Tree appends `flip && …` to its
            stylesheet, which writes "undefined" there when it is left out. */}
        <TreeOfLife
          height="150px"
          topText=""
          active={sephirah.id}
          showDaat={hidden}
          flip={false}
        />
      </FigureNav>

      <h1>
        {name.roman} · <Hebrew>{name.he}</Hebrew>
      </h1>

      <Lede>
        {name.en},{" "}
        {hidden
          ? "the hidden Sephirah of the Tree of Life."
          : `the ${ORDINALS[sephirah.index - 1]} Sephirah of the Tree of Life.`}
      </Lede>

      <EntityTable>
        <Row label="Name">
          <Name original={name.he} roman={name.roman} meaning={name.en} />
        </Row>
        <Row label="Heaven">
          {sephirah.tenHeavens ? (
            <Name
              original={sephirah.tenHeavens.he}
              roman={sephirah.tenHeavens.roman}
              meaning={sephirah.tenHeavens.en}
            />
          ) : null}
        </Row>
        <Row label="God name" aside={<World>Atziluth</World>}>
          {sephirah.godName ? (
            <Name
              original={sephirah.godName.name.he}
              roman={sephirah.godName.name.roman}
              meaning={sephirah.godName.name.en}
            />
          ) : null}
        </Row>
        <Row label="Archangel" aside={<World>Briah</World>}>
          {sephirah.archangel ? (
            <Name
              original={sephirah.archangel.name.he}
              roman={sephirah.archangel.name.roman}
            />
          ) : null}
        </Row>
        <Row label="Angelic order" aside={<World>Yetzirah</World>}>
          {sephirah.angelicOrder ? (
            <Name
              original={sephirah.angelicOrder.name.he}
              roman={sephirah.angelicOrder.name.roman}
              meaning={sephirah.angelicOrder.name.en}
            />
          ) : null}
        </Row>
        {/* Keter, Chochmah and Malchut have a sphere here, not a planet. */}
        <Row
          label={planet?.kind === "sphere" ? "Sphere" : "Planet"}
          aside={<World>Assiah</World>}
        >
          {planet ? (
            <Link href={`/astrology/planet/${planet.id}`}>
              {planet.symbol ? `${planet.symbol} ` : null}
              {planet.name.en.en}
            </Link>
          ) : null}
        </Row>
        <Row label="Colours">
          <div className={styles.swatches}>
            {color.king ? (
              <Swatch
                scale="King scale"
                name={color.king}
                web={color.kingWeb}
                text={color.kingWebText}
              />
            ) : null}{" "}
            <Swatch
              scale="Queen scale"
              name={color.queen}
              web={color.queenWeb}
              text={color.queenWebText}
            />
          </div>
        </Row>
        <Row label="Soul">
          {soul ? (
            <Name
              original={soul.name.he}
              roman={capitalise(soul.name.roman)}
              meaning={soul.name.en}
            />
          ) : null}
        </Row>
        <Row label="Chakra">
          {chakra ? (
            <div className={styles.chakra}>
              <span>
                {chakra.name.en}{" "}
                <Name
                  original={chakra.name.sa}
                  roman={chakra.name.roman}
                  meaning={chakra.meaning.en}
                  script="sa"
                />
              </span>
              <Chakras height="80px" active={chakra.id} />
            </div>
          ) : null}
        </Row>
        <Row label="Body">{capitalise(sephirah.body)}</Row>
        <Row label="Stone">{capitalise(sephirah.stone)}</Row>
        <Row label="Scent">{capitalise(sephirah.scent)}</Row>
        <Row label="Grade">
          {gdGrade ? (
            <Link href={`/gd/grade/${gdGrade.id}`}>
              {gdGrade.id} {gdGrade.name}
            </Link>
          ) : null}
        </Row>
      </EntityTable>

      {paths.length ? (
        <>
          <h2>Paths</h2>
          <ul className={styles.paths}>
            {[...hermetic, ...hebrewOnly].map((path) => (
              <PathItem key={path.id} path={path} from={sephirah} />
            ))}
          </ul>
        </>
      ) : null}

      <PrevNext label="Sephirot" prev={prev} next={next} />
    </EntityFrame>
  );
}
