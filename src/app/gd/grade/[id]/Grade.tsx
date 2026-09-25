import Link from "@magick-components/Link";
import Data from "@/../data/data";
import type { GDGradeRow } from "@/../data/rows";
import {
  EntityFrame,
  EntityTable,
  FigureNav,
  Lede,
  Muted,
  type Neighbour,
  PrevNext,
  Row,
  Trail,
} from "@/components/entity";
import GradeTree from "@/components/gd/GradeTree";
import { isPublicRitualId } from "@/doc/publicRituals";
import { PUBLIC_PAGES } from "@/seo/pages";
import styles from "./grade.module.css";

/**
 * One grade of the Golden Dawn, laid out from its row (plan 036, "Grade"):
 * the grade tree with its sephirah lit, then its order, degree, sephirah,
 * planet and element, the ritual where the site has it, and the alchemy
 * the grade teaches.
 */

/** The orders' and the degrees' ids, as words. */
const ORDINAL: Readonly<Record<string, string>> = {
  "1st": "First",
  "2nd": "Second",
  "3rd": "Third",
};

/** A degree's pillar, as the Degree row reads it (decision 6). */
const PILLAR: Readonly<Record<string, string>> = {
  severity: "Pillar of Severity",
  mercy: "Pillar of Mercy",
  middle: "Middle Pillar",
};

/**
 * An `active` that names no sphere. The Tree lights every sphere when
 * `active` is absent, so a grade with no sephirah passes this instead, and
 * every sphere is drawn dimmed: the figure says what the missing Sephirah
 * row says (decision 16).
 */
const NO_SPHERE = "none";

/** "Theoricus 2=9", or "Portal": the name, and the id where it is numbers. */
function title(grade: GDGradeRow) {
  return /=/.test(grade.id) ? `${grade.name} ${grade.id}` : grade.name;
}

function neighbour(grade: GDGradeRow | undefined): Neighbour | undefined {
  return grade && { href: `/gd/grade/${grade.id}`, label: title(grade) };
}

/**
 * The grade that teaches an alchemy symbol or term, as those tables number
 * it: the first number of the grade's id, the 1 of 1=10. The Portal has none.
 */
function taughtAt(grade: GDGradeRow) {
  const numbers = /^(\d+)=\d+$/.exec(grade.id);
  return numbers ? Number(numbers[1]) : undefined;
}

function GradeLede({ grade }: { grade: GDGradeRow }) {
  if (!grade.orderId) {
    // The Portal alone is in no order; its neighbours are the two it joins.
    const [from, to] = [grade.prev?.orderId, grade.next?.orderId];
    return (
      <Lede>
        The grade that stands between the {from && ORDINAL[from]} and{" "}
        {to && ORDINAL[to]} Orders.
      </Lede>
    );
  }
  return (
    <Lede>
      A grade of the {ORDINAL[grade.orderId]} Order,{" "}
      {grade.sephirah ? (
        <>
          attributed to{" "}
          <Link href={`/kabbalah/sephirah/${grade.sephirah.id}`}>
            {grade.sephirah.name.roman}
          </Link>
        </>
      ) : (
        "not attributed to a Sephirah"
      )}
      .
    </Lede>
  );
}

/** The symbols and terms the grade teaches, in the tables' order. */
function alchemyOf(grade: GDGradeRow) {
  const taught = taughtAt(grade);
  return {
    symbols: Object.values(Data.alchemySymbol).filter(
      (s) => s.gdGrade === taught,
    ),
    terms: Object.values(Data.alchemyTerm).filter((t) => t.gdGrade === taught),
  };
}

/**
 * The alchemy a grade teaches, which is the Zelator's (decision 7): the
 * principles and the metals by symbol and name, each metal beside the
 * planet it is attributed to, and the terms with their glosses. Three short
 * groups under captions in one cell, so that sixteen entries read as the
 * three lists they are rather than as sixteen rows of the table.
 */
function Alchemy({ symbols, terms }: ReturnType<typeof alchemyOf>) {
  const principles = symbols.filter((s) => s.category === "principles");
  const metals = symbols.filter((s) => s.category === "planets");
  return (
    <div className={styles.alchemy}>
      {principles.length ? (
        <div>
          <div className={styles.caption}>Principles</div>
          <ul className={styles.principles}>
            {principles.map((s) => (
              <li key={s.id}>{`${s.symbol} ${s.name.en}`}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {metals.length ? (
        <div>
          <div className={styles.caption}>Metals</div>
          <ul>
            {metals.map((s) => (
              <li key={s.id}>
                {`${s.symbol} ${s.name.en} · `}
                {s.planet ? (
                  <Link href={`/astrology/planet/${s.planet.id}`}>
                    {`${s.planet.symbol} ${s.planet.name.en.en}`}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {terms.length ? (
        <div>
          <div className={styles.caption}>Terms</div>
          <ul className={styles.terms}>
            {terms.map((t) => (
              <li key={t.id}>
                {t.name.en}
                <Muted>{` — ${t.terms.en.join("; ")}`}</Muted>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The page body, synchronous so that `renderToString` can render it. */
export default function GradePage({ grade }: { grade: GDGradeRow }) {
  const prev = neighbour(grade.prev);
  const next = neighbour(grade.next);
  const { degree, element, planet, sephirah } = grade;
  // The built-in rituals are keyed by the grade's name in lower case, which
  // is the mapping the data already carries (decision 6).
  const ritual = grade.name.toLowerCase();
  const alchemy = alchemyOf(grade);

  return (
    <EntityFrame>
      <Trail href="/gd/grades">Grades</Trail>

      <FigureNav prev={prev} next={next}>
        {/* `flip` is passed because the Tree appends `flip && …` to its
            stylesheet, which writes "undefined" there when it is left out. */}
        <GradeTree
          height="150px"
          topText=""
          active={sephirah?.id ?? NO_SPHERE}
          flip={false}
        />
      </FigureNav>

      <h1>{title(grade)}</h1>
      <GradeLede grade={grade} />

      <EntityTable>
        <Row label="Order">
          {grade.orderId ? `${ORDINAL[grade.orderId]} Order` : null}
        </Row>
        <Row label="Degree">
          {degree
            ? `${ORDINAL[degree.id]} Degree · ${PILLAR[degree.pillarId]}`
            : null}
        </Row>
        <Row label="Sephirah">
          {sephirah ? (
            <Link href={`/kabbalah/sephirah/${sephirah.id}`}>
              {sephirah.name.roman}
            </Link>
          ) : null}
        </Row>
        <Row label="Planet">
          {planet ? (
            <Link href={`/astrology/planet/${planet.id}`}>
              {`${planet.symbol} ${planet.name.en.en}`}
            </Link>
          ) : null}
        </Row>
        <Row label="Element">
          {element ? (
            <>
              {`${element.symbol} ${element.name.en}`}
              {element.elemental
                ? ` · the ${element.elemental.namePlural.en}`
                : null}
            </>
          ) : null}
        </Row>
        <Row label="Ritual">
          {isPublicRitualId(ritual) ? (
            <Link href={`/doc/${ritual}`}>
              {PUBLIC_PAGES[`/doc/${ritual}` as const].title}
            </Link>
          ) : null}
        </Row>
        <Row label="Alchemy">
          {alchemy.symbols.length || alchemy.terms.length ? (
            <Alchemy {...alchemy} />
          ) : null}
        </Row>
      </EntityTable>

      <PrevNext label="Grades" prev={prev} next={next} />
    </EntityFrame>
  );
}
