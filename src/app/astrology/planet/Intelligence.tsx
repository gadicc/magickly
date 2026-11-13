import MuiLink from "@mui/material/Link";
import type { PlanetRow } from "magick-data/rows";
import { Hebrew } from "@/ui/entity";
import styles from "./intelligence.module.css";

/** What the two components read of a planet's row. */
type WithIntelligence = Pick<
  PlanetRow,
  "intelligenceId" | "intelligenceOfIntelligences"
>;

/**
 * The anchors of the notes and of the references to them. A page shows the
 * Moon's intelligence once, so they are fixed.
 */
export const NOTE_IDS = {
  notes: "intelligence-notes",
  heading: "intelligence-notes-heading",
  note: (n: 1 | 2) => `intelligence-note-${n}`,
  ref: (n: 1 | 2) => `intelligence-ref-${n}`,
} as const;

/** The Moon's intelligence of intelligences, in Agrippa's 1533 printing. */
const AGRIPPA_1533 =
  "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up";

/** The ids are lower case, with no table yet. */
function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * A superscript link to note `n`, and the place its "back" link returns to.
 * Described by the notes' heading, so a screen reader hears "1, Notes".
 */
function NoteRef({ n }: { n: 1 | 2 }) {
  return (
    <sup className={styles.ref}>
      <MuiLink
        href={`#${NOTE_IDS.note(n)}`}
        id={NOTE_IDS.ref(n)}
        aria-describedby={NOTE_IDS.heading}
      >
        {n}
      </MuiLink>
    </sup>
  );
}

/**
 * A planet's intelligence, capitalised from its id. The Moon has two
 * names, and both are given: Agrippa's intelligence of intelligences and
 * Shelachel, each with a note that `IntelligenceNotes` holds. `hebrew`
 * puts Agrippa's Hebrew before his name, as the planet page sets names.
 */
export function Intelligence({
  planet,
  hebrew = false,
}: {
  planet: WithIntelligence;
  hebrew?: boolean;
}) {
  const id = planet.intelligenceId;
  const classical = planet.intelligenceOfIntelligences;
  if (!id) return null;
  if (!classical) return <>{capitalize(id)}</>;
  return (
    <>
      {hebrew ? (
        <>
          <Hebrew>{classical.he}</Hebrew>{" "}
        </>
      ) : null}
      <span lang="he-Latn">{classical.roman.agrippa1533}</span>
      <NoteRef n={1} /> / {capitalize(id)}
      <NoteRef n={2} />
    </>
  );
}

/**
 * The two notes on the Moon's names, for the foot of a page that shows
 * them; nothing for any other planet. Each ends with a link back to its
 * reference. `level` is the heading's, under the page's own headings.
 */
export function IntelligenceNotes({
  planet,
  level = 2,
}: {
  planet: WithIntelligence;
  level?: 2 | 3;
}) {
  const classical = planet.intelligenceOfIntelligences;
  if (!planet.intelligenceId || !classical) return null;
  const Heading = level === 2 ? "h2" : "h3";
  const shelachel = capitalize(planet.intelligenceId);
  return (
    <section
      id={NOTE_IDS.notes}
      aria-labelledby={NOTE_IDS.heading}
      className={styles.notes}
    >
      <Heading id={NOTE_IDS.heading}>Notes</Heading>
      <ol>
        <li id={NOTE_IDS.note(1)}>
          <span lang="he-Latn">{classical.roman.agrippa1533}</span> is the
          classical name. Agrippa gives the Moon no single intelligence: in{" "}
          <MuiLink href={AGRIPPA_1533}>
            <cite>De occulta philosophia</cite> (1533), Book II, chapter 22
          </MuiLink>
          , he names an “intelligence of intelligences” in its place, numbered
          3321, the sum of the Moon&apos;s magic square. Crowley&apos;s{" "}
          <cite>777</cite> gives the same name, as{" "}
          <span lang="he-Latn">{classical.roman.crowley777}</span>, and so does
          the Golden Dawn tradition, as{" "}
          <span lang="he-Latn">{classical.roman.regardie1940}</span> in the
          Order&apos;s papers Regardie published. <BackLink n={1} />
        </li>
        <li id={NOTE_IDS.note(2)}>
          {shelachel} is a short modern name found in present-day sources. We
          have not found where it comes from: it is not in Agrippa, in{" "}
          <cite>777</cite> or in Heydon&apos;s <cite>Theomagia</cite> (1663).{" "}
          <BackLink n={2} />
        </li>
      </ol>
    </section>
  );
}

/** The way back from note `n` to where the page refers to it. */
function BackLink({ n }: { n: 1 | 2 }) {
  return (
    <MuiLink
      href={`#${NOTE_IDS.ref(n)}`}
      aria-label={`Back to reference ${n}`}
      className={styles.back}
    >
      {/* The text presentation of the arrow, not the emoji. */}
      ↩&#xFE0E;
    </MuiLink>
  );
}
