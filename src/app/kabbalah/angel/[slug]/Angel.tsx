import Link from "next/link";
import zodiacs from "@/../data/astrology/Zodiac";
import Data from "@/../data/data";
import { angelSlug } from "@/../data/kabbalah/angelSlugs";
import christianChoirs from "@/../data/kabbalah/ChristianChoirs";
import { anchorOfGenius, notesOfGenius } from "@/../data/kabbalah/lenain/notes";
import type { Angel } from "@/../data/kabbalah/SeventyTwoAngels";
import { loadAngelTexts } from "@/../data/kabbalah/SeventyTwoAngelsText";
import {
  ANGEL_COUNT,
  choirOf,
  decadeOf,
  degreesOf,
  governedDaysOf,
  invocationOf,
  type MonthDay,
  planetOf,
  presidingDaysOf,
  signOf,
} from "@/../data/kabbalah/seventyTwoAngelsDerived";
import styles from "./angel.module.css";

/**
 * One genius, server-rendered.
 *
 * The list page keeps all seventy-two behind accordions that unmount when
 * closed, and loads their prose on the client, so production serves none of
 * this: "Vehuiah" appears three times in that HTML and "God elevated and
 * exalted" not at all. Everything a reader or a crawler wants is in the markup
 * here. See plan 033's follow-ups.
 *
 * English here, French on the book's routes, each linking to the other — so
 * the two pages answer different questions rather than competing to answer
 * the same one.
 */

const BOOK = "/books/la-science-cabalistique";

const formatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
});

/** Lenain's days belong to the year, not to one of them; 2001 is common. */
function day([month, dayOfMonth]: MonthDay) {
  return formatter.format(new Date(2001, month - 1, dayOfMonth));
}

/** The planet a decade falls under, named rather than identified. */
function planetName(id: string) {
  const planets = Data.planet as Record<
    string,
    { name: { en: { en: string } } }
  >;
  return Object.hasOwn(planets, id) ? planets[id].name.en.en : id;
}

function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

export default async function AngelPage({ angel }: { angel: Angel }) {
  const no = angel.no;
  const sign = signOf(no);
  const degrees = degreesOf(no);
  const invocation = invocationOf(no);
  const governed = governedDaysOf(no);
  const choir = christianChoirs[choirOf(no) - 1];
  const notes = notesOfGenius(no);
  const anchor = anchorOfGenius(no);

  // Both languages, at build time: this page is static, and the point of it
  // is that the text is in the HTML rather than fetched after it.
  const [english, french] = await Promise.all([
    loadAngelTexts("en"),
    loadAngelTexts("fr"),
  ]);

  const previous = no > 1 ? no - 1 : undefined;
  const next = no < ANGEL_COUNT ? no + 1 : undefined;

  return (
    <div className={styles.angel}>
      <p className={styles.trail}>
        <Link href="/kabbalah/yhvh/72angels">The 72 Angels</Link>
      </p>

      <h1>
        {no}. {angel.name.en}
        {angel.name.he ? (
          <>
            {" "}
            <span lang="he" dir="rtl" className={styles.hebrew}>
              {angel.name.he}
            </span>
          </>
        ) : null}
      </h1>

      {angel.attribute.en ? (
        <p className={styles.attribute}>
          “{angel.attribute.en}”
          {angel.attribute.fr ? (
            <>
              {" — "}
              <span lang="fr">
                <i>{angel.attribute.fr}</i>
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <table className={styles.table}>
        <tbody>
          <Row label="Angel">{angel.name.en}</Row>
          <Row label="Hebrew">
            {angel.name.he ? (
              <>
                <span lang="he" dir="rtl" className={styles.hebrew}>
                  {angel.name.he}
                </span>
                {angel.name.hePointed ? (
                  <>
                    {" — as Lenain points it: "}
                    <span lang="he" dir="rtl" className={styles.hebrew}>
                      {angel.name.hePointed}
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </Row>
          <Row label="Rules">{angel.people.en}</Row>
          <Row label="God name">{angel.godName}</Row>
          <Row label="Choir">{choir.name.en}</Row>
          <Row label="Zodiac">
            {sign.from}–{sign.to}° of {zodiacs[sign.zodiacId].name.en}
          </Row>
          <Row label="Degrees of the sphere">
            {degrees.from}–{degrees.to}
          </Row>
          <Row label="Decade">
            {/* planetOf gives the id; a reader wants the planet's name. */}
            {decadeOf(no)} of 36, under {planetName(planetOf(no))}
          </Row>
          <Row label="Governs the days">
            {day(governed.from)} – {day(governed.to)}
          </Row>
          <Row label="Presides on">
            {presidingDaysOf(no).map(day).join(", ")}
          </Row>
          <Row label="Invocation">
            {clock(invocation.from)} – {clock(invocation.to)}
          </Row>
          <Row label="Psalm">
            {angel.psalm.psalm > 0 ? (
              <>
                {angel.psalm.psalm}:{angel.psalm.verse}
                {angel.psalm.la ? (
                  <>
                    {" — "}
                    <span lang="la">
                      <i>{angel.psalm.la}</i>
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </Row>
          <Row label="Invoked for">{angel.invokedFor.en}</Row>
          <Row label="Influences">{angel.governs.en}</Row>
          <Row label="Born under">{angel.bornUnder.en}</Row>
          <Row label="Contrary genius">{angel.contrary.en}</Row>
        </tbody>
      </table>

      <h2>Lenain’s entry</h2>
      <p className={styles.said}>{english[no - 1]}</p>

      <h2 lang="fr">Le texte de Lenain</h2>
      <p lang="fr" className={styles.said}>
        {french[no - 1]}
      </p>

      {notes.length ? (
        <>
          <h2>Editorial notes</h2>
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={`${note.field}-${note.printed}`}>
                <strong>{note.field}</strong>{" "}
                <span className={styles.kind}>{note.kind}</span>
                {note.printed ? (
                  <>
                    {" · "}
                    {note.printed}
                    {note.used ? ` → ${note.used}` : ", kept as printed"}
                  </>
                ) : null}
                {" — "}
                {note.why}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>In the book</h2>
      <p>
        Printed on page{angel.printedPages.length > 1 ? "s" : ""}{" "}
        {angel.printedPages.join(" and ")} of{" "}
        <Link href={BOOK}>
          <i>La Science Cabalistique</i>
        </Link>
        , Amiens 1823.{" "}
        {anchor ? (
          <Link href={`${BOOK}/chapitre-6#${anchor}`}>
            Read it in the French, on the page
          </Link>
        ) : null}
      </p>

      <nav className={styles.nav} aria-label="Angels">
        {previous ? (
          <Link href={`/kabbalah/angel/${angelSlug(previous)}`}>
            ← {previous}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/kabbalah/angel/${angelSlug(next)}`}>{next} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
