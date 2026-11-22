import type { KameaPlanetId } from "magick-data/astrology/kameas";
import type {
  PlanetaryNameCount,
  PlanetaryNameReading,
} from "magick-data/astrology/planetaryNames";
import UiText from "@/i18n/UiText";
import { Hebrew } from "@/ui/entity";
import Link from "@/ui/Link";
import { CONSTANT_LABELS, constantOf } from "./kameaPlanets";
import LeafLinks from "./LeafLinks";
import styles from "./names.module.css";
import {
  agrippaHebrew,
  exceptionOf,
  type PlanetaryName,
  type PlanetaryNameException,
  planetaryNamePath,
  ROLE_LABELS,
  readingOf,
} from "./planetaryNames";
import {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryNameWitness,
  readingLeaves,
  WITNESS_LABELS,
} from "./witnesses";

/** How a printed number is reached, where it is not the plain sum. */
const COUNT_LABELS: Record<PlanetaryNameCount, string> = {
  finals: /*i18n*/ "with the final letters at 500 to 900",
  pairs: /*i18n*/ "for each pair of its letters",
};

/** Whose an exception's difference is (`whose`, `from`). */
const WHOSE_LABELS = {
  printing: /*i18n*/ "A slip of this printing, its author's or its printer's.",
  unsettled:
    /*i18n*/ "Whose the difference is, the evidence read does not settle.",
} as const;

/** An inherited difference, by the witness it was taken from. */
const INHERITED_LABELS: Partial<Record<PlanetaryNameWitness, string>> = {
  agrippa1533: /*i18n*/ "Taken over from Agrippa 1533.",
  agrippa1651: /*i18n*/ "Taken over from Agrippa 1651.",
};

/** The name whose division into two words is ours (decision 10). */
const DIVIDED = "schedbarschemoth-schartathan";

/**
 * A number a witness prints that its letters do not give, as the exception
 * row says it (`planetaryNameExceptions`): what it prints, what the letters
 * give, whose the difference is, and the row's note. The page renders the
 * rows the data test holds the numbers to, so the two cannot drift.
 */
export function ExceptionNote({
  exception,
}: {
  exception: PlanetaryNameException;
}) {
  const whose =
    exception.whose === "inherited"
      ? (INHERITED_LABELS[exception.from as PlanetaryNameWitness] ??
        /*i18n*/ "Taken over from an earlier printing.")
      : WHOSE_LABELS[exception.whose];
  return (
    <span className={styles.exception} data-exception={exception.id}>
      <UiText
        message={
          /*i18n*/ "Prints {printed}, where its letters give {expected}."
        }
        values={{ printed: exception.printed, expected: exception.expected }}
      />{" "}
      <UiText message={whose} />{" "}
      {/* The row's note, in English, as the data records it. */}
      <span lang="en">{exception.note}</span>
    </span>
  );
}

/**
 * A reading's number, and how it is counted where that is not the sum:
 * run on in a reading's line, or under the number in the table's column
 * (`block`), where a long count would otherwise widen it.
 */
function PrintedNumber({
  reading,
  block = false,
}: {
  reading: PlanetaryNameReading;
  block?: boolean;
}) {
  if (reading.number === undefined) return null;
  return (
    <>
      {reading.number}
      {reading.count ? (
        <>
          {" "}
          <span className={block ? styles.constant : undefined}>
            <UiText message={COUNT_LABELS[reading.count]} />
          </span>
        </>
      ) : null}
    </>
  );
}

/**
 * Every witness's reading of a name, each linked to its leaf (AGENTS.md,
 * "show the evidence"): the witness, its leaves, its romanisation or
 * caption, its Hebrew where it spells the name otherwise than Agrippa's
 * 1533, its number, the reading's note, and the exception to its number,
 * if any. `planet` outlines the planet's names on Agrippa's mirrored
 * leaves. Nothing for a name no witness gives.
 */
export function NameWitnesses({
  name,
  planet,
}: {
  name: PlanetaryName;
  planet: KameaPlanetId;
}) {
  const agrippa = agrippaHebrew(name);
  const readings = PLANETARY_NAME_WITNESSES.flatMap((witness) => {
    const reading = readingOf(name, witness);
    return reading ? [{ witness, reading }] : [];
  });
  if (!readings.length) return null;
  return (
    <ul className={styles.witnesses}>
      {readings.map(({ witness, reading }) => {
        const exception = exceptionOf(name, witness);
        const leaves = readingLeaves(witness, reading, planet);
        // Another witness's Hebrew only where it spells the name otherwise.
        const he = reading.he && reading.he !== agrippa ? reading.he : null;
        return (
          <li key={witness} data-witness={witness}>
            <span className={styles.witness}>
              <UiText message={WITNESS_LABELS[witness]} />
            </span>
            {leaves.length ? (
              <>
                {" "}
                <LeafLinks leaves={leaves} />
              </>
            ) : null}
            {": "}
            {reading.roman ? <span>{reading.roman}</span> : null}
            {reading.caption ? (
              <>
                {reading.roman ? ", " : null}
                <q lang={witness === "agrippa1533" ? "la" : "en"}>
                  {reading.caption}
                </q>
              </>
            ) : null}
            {he ? (
              <>
                {reading.roman || reading.caption ? ", " : null}
                <Hebrew>{he}</Hebrew>
              </>
            ) : null}
            {reading.number !== undefined ? (
              <>
                {reading.roman || reading.caption || he ? ", " : null}
                <PrintedNumber reading={reading} />
              </>
            ) : null}
            {reading.note ? (
              <>
                {". "}
                <span lang="en" className={styles.note}>
                  {reading.note}
                </span>
              </>
            ) : null}
            {exception ? (
              <>
                {/* A sentence of its own, after the note's or the number. */}
                {reading.note?.endsWith(".") ? " " : ". "}
                <ExceptionNote exception={exception} />
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** What the page says of a name beyond its readings, in our words. */
function NameNote({ name }: { name: PlanetaryName }) {
  if (name.id === DIVIDED)
    return (
      <p className={styles.nameNote}>
        <UiText
          message={
            /*i18n*/ "Agrippa prints it as one word of fourteen letters. Dividing it in two, where its romanisation divides it, is ours, and is how this site traces it."
          }
        />
      </p>
    );
  if (!agrippaHebrew(name))
    return (
      <p className={styles.nameNote}>
        <UiText
          message={
            /*i18n*/ "A name found in present-day sources, which none of these witnesses gives. We have not found where it comes from, and it has no sigil here: there are no letters to trace."
          }
        />
      </p>
    );
  const romanised = PLANETARY_NAME_WITNESSES.some(
    (witness) => readingOf(name, witness)?.roman,
  );
  if (!romanised)
    return (
      <p className={styles.nameNote}>
        <UiText
          message={
            /*i18n*/ "No witness romanises it; the name given here is our transcription of its letters."
          }
        />
      </p>
    );
  return null;
}

/**
 * A planet's names (plan 093, "Pages"): for each, what it is to the planet,
 * its name (linked to its own page where it has one), Agrippa's Hebrew of
 * 1533 in Frank Ruhl Libre, the number he prints and which of the
 * square's four numbers it is; then every witness's reading with its leaf,
 * and the exceptions to the printed numbers as the data records them.
 * `labelledBy` is the id of the heading above it.
 */
export default function NamesTable({
  names,
  planet,
  labelledBy,
}: {
  names: PlanetaryName[];
  planet: KameaPlanetId;
  labelledBy?: string;
}) {
  return (
    <div className={styles.scroll}>
      <table className={styles.names} aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col">
              <UiText message={/*i18n*/ "Name"} />
            </th>
            <th scope="col">
              <UiText message={/*i18n*/ "Hebrew"} />
            </th>
            <th scope="col">
              <UiText message={/*i18n*/ "Number"} />
            </th>
          </tr>
        </thead>
        {names.map((name) => {
          const agrippa = readingOf(name, "agrippa1533");
          const constant = constantOf(planet, agrippa?.number);
          const path = planetaryNamePath(name);
          return (
            <tbody key={name.id} id={`name-${name.id}`} data-name={name.id}>
              <tr className={styles.name}>
                <th scope="row">
                  <span className={styles.role}>
                    <UiText message={ROLE_LABELS[name.role]} />
                  </span>{" "}
                  {path ? (
                    <Link href={path}>{name.name.roman}</Link>
                  ) : (
                    <span>{name.name.roman}</span>
                  )}
                </th>
                <td>{agrippa?.he ? <Hebrew>{agrippa.he}</Hebrew> : null}</td>
                <td>
                  {agrippa ? <PrintedNumber reading={agrippa} block /> : null}
                  {constant ? (
                    <span className={styles.constant}>
                      <UiText message={CONSTANT_LABELS[constant]} />
                    </span>
                  ) : null}
                </td>
              </tr>
              <tr className={styles.readings}>
                <td colSpan={3}>
                  <NameNote name={name} />
                  <NameWitnesses name={name} planet={planet} />
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
