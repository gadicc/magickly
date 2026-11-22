import { KameaSigil, kameaSigil } from "magick-components/astrology/KameaSigil";
import type { ReactNode } from "react";
import { rowHref } from "@/app/open-source/data/tables";
import { H2 } from "@/app/PageText";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import JsonLd from "@/seo/JsonLd";
import {
  planetaryNameJsonLd,
  planetaryNameSigilFiles,
  planetaryNameSigilText,
} from "@/seo/planetaryNames";
import {
  EntityFrame,
  EntityTable,
  Hebrew,
  Lede,
  Muted,
  Row,
  Trail,
} from "@/ui/entity";
import Link from "@/ui/Link";
import {
  CONSTANT_LABELS,
  constantOf,
  KAMEA_HUB_PATH,
  KAMEA_SQUARE_LABELS,
  type KameaPlanetId,
  kameaPath,
} from "./kameaPlanets";
import { LeafLink } from "./LeafLinks";
import CharacterDrawing, {
  CHARACTER_READER,
  characterLiberties,
  characterStrokes,
  READER_NAMES,
} from "./NameCharacter";
import { SigilLabel } from "./NameFigures";
import { NameWitnesses } from "./NamesTable";
import styles from "./namePage.module.css";
import {
  agrippaRoman,
  type CharacterWitness,
  characterOf,
  exceptionOf,
  otherSpellings,
  type PlanetaryName,
  type PlanetaryNameCharacter,
  planetOfName,
  readingOf,
  squareNumberOf,
} from "./planetaryNames";
import ReductionTable from "./ReductionTable";
import { kameaSigilPagePath } from "./sigils/kameaSigilState";
import { reduceOnKamea } from "./sigils/reduction";
import {
  AGRIPPA_LEAF_PAGES,
  leafNumbers,
  leafRef,
  WITNESS_ITEMS,
  WITNESS_LABELS,
} from "./witnesses";

/**
 * What each name is to its planet, as its page's lede says it: one message
 * a name, so that a translation can decline the planet's name in it. A
 * test holds the keys to the names with pages.
 */
export const NAME_LEDES: Record<string, string> = {
  agiel: /*i18n*/ "The intelligence of Saturn.",
  zazel: /*i18n*/ "The spirit of Saturn.",
  iophiel: /*i18n*/ "The intelligence of Jupiter.",
  hismael: /*i18n*/ "The spirit of Jupiter.",
  graphiel: /*i18n*/ "The intelligence of Mars.",
  bartzabel: /*i18n*/ "The spirit of Mars.",
  nakhiel: /*i18n*/ "The intelligence of the Sun.",
  sorath: /*i18n*/ "The spirit of the Sun.",
  hagiel: /*i18n*/ "The intelligence of Venus.",
  kedemel: /*i18n*/ "The spirit of Venus.",
  "bne-seraphim": /*i18n*/ "The intelligences of Venus, in Agrippa's plural.",
  tiriel: /*i18n*/ "The intelligence of Mercury.",
  taphthartharath: /*i18n*/ "The spirit of Mercury.",
  chasmodai: /*i18n*/ "The spirit of the Moon.",
  "schedbarschemoth-schartathan": /*i18n*/ "The spirit of spirits of the Moon.",
  "malcha-betharsisim":
    /*i18n*/ "The intelligence of intelligences of the Moon, which Agrippa names where the other planets have an intelligence.",
};

/** How a trace counts final letters, where it is not at their own values. */
const FINALS_LABELS: Partial<Record<string, string>> = {
  final: /*i18n*/ "That trace counts the final letters at 500 to 900.",
  mixed:
    /*i18n*/ "That trace counts the final letters at 500 to 900 in some words and at their ordinary values in others.",
};

/** Our verdict on a figure, the spelling it is the trace of as `<0>`. */
const VERDICT_LABELS: Record<string, string> = {
  match:
    /*i18n*/ "Our reading: it is the trace of <0>{spelling}</0> on the square, drawn freely.",
  partial:
    /*i18n*/ "Our reading: it is the trace of <0>{spelling}</0> on the square, in part.",
  no: /*i18n*/ "Our reading: it is not recognisably the trace of any spelling; the nearest is <0>{spelling}</0>.",
};

/**
 * Where the two judges' verdicts differ, by the pair, in either order:
 * said only where the row has no note, which says it in its own words.
 */
const SPLIT_LABELS: Record<string, string> = {
  "match partial":
    /*i18n*/ "The two judges differed, one finding a match and the other a partial one.",
  "no partial":
    /*i18n*/ "The two judges differed, one finding no trace and the other a partial one.",
  "match no":
    /*i18n*/ "The two judges differed, one finding a match and the other no trace.",
};

/** Regardie's plates: the printed page of a leaf of vol. 4 (n75 is p. 81). */
const regardiePage = (leaf: number) => leaf + 6;

/** The figure's box's prefix in our ids, by printing. */
const ID_PREFIX: Record<CharacterWitness, string> = {
  agrippa1533: "agrippa",
  regardie1940: "regardie",
};

/** An outside link, as the page's other outside links are drawn. */
function Outside({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} rel="noopener">
      {children}
    </Link>
  );
}

/** Regardie's vol. 4: the method of tracing a name on pp. 78–80. */
const regardieMethod = leafRef(WITNESS_ITEMS.regardie1940, 72).href;

/**
 * A text traced on the planet's square, drawn by the server (plan 093,
 * K3's note: a page draws its figures where they are rendered), at the
 * square's least size, named by `SigilLabel` out of sight.
 */
function TracedSigil({
  id,
  name,
  planet,
  text,
}: {
  id: string;
  name: string;
  planet: KameaPlanetId;
  text: string;
}) {
  const sigil = kameaSigil(planet, text);
  const labelId = `${id}-label`;
  return (
    <figure className={styles.figure} data-sigil={text}>
      <SigilLabel id={labelId} name={name} hebrew={text} planet={planet} />
      <div role="img" aria-labelledby={labelId}>
        <KameaSigil
          planet={planet}
          text={text}
          sigil={sigil}
          label={false}
          className={styles.sigil}
        />
      </div>
      {sigil.failed ? (
        <p className={styles.note}>
          <UiText
            message={
              /*i18n*/ "This sigil could not be drawn so that every mark stands clear of the others and of the square's lines; it is drawn as well as it can be, and may be hard to read."
            }
          />
        </p>
      ) : null}
      <ReductionTable reduction={reduceOnKamea(planet, text, false)} />
    </figure>
  );
}

/** Our verdict on one printing's figure of a name, as the data gives it. */
function Verdict({ character }: { character: PlanetaryNameCharacter }) {
  const judges = character.judges as Record<string, string>;
  const verdicts = [...new Set(Object.values(judges))].sort();
  const split = verdicts.length > 1 ? SPLIT_LABELS[verdicts.join(" ")] : null;
  const cells = (character.cellsRead as number[][] | undefined)
    ?.map((word) => word.join(", "))
    .join(" | ");
  const finals = FINALS_LABELS[character.finals];
  return (
    <>
      <p>
        <UiRichText
          message={VERDICT_LABELS[character.verdict]}
          values={{ spelling: character.spelling }}
          components={{
            0: <span lang="he" dir="rtl" className={styles.hebrew} />,
          }}
        />
        {finals ? (
          <>
            {" "}
            <UiText message={finals} />
          </>
        ) : null}
      </p>
      {character.departures.length ? (
        <p>
          <UiText message={/*i18n*/ "Where it departs from that trace:"} />
        </p>
      ) : null}
      {character.departures.length ? (
        <ul className={styles.list} data-departures={character.id}>
          {cells ? (
            <li>
              <UiText
                message={/*i18n*/ "Its turns sit on the cells {cells}."}
                values={{ cells }}
              />
            </li>
          ) : null}
          {character.departures.map((departure) => (
            <li key={departure} lang="en">
              {departure}
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        <UiText message={/*i18n*/ "Its marks:"} />{" "}
        <span lang="en">{character.marks}</span>
      </p>
      {character.note ? (
        <p data-judges={character.id}>
          <span lang="en">{character.note}</span>
        </p>
      ) : split ? (
        <p data-judges={character.id}>
          <UiText message={split} />
        </p>
      ) : null}
    </>
  );
}

/**
 * One planetary intelligence or spirit (plan 093, "Pages" and decision 8):
 * its Hebrew and every witness's reading with their leaves; its number and
 * which of the square's numbers it is; the sigil traced on its square,
 * with the reduction and the other witnesses' traces where they differ;
 * Agrippa's character, redrawn from our reading of the woodcut, and our
 * verdict on it and on Regardie's redrawing, whose figure is neither shown
 * nor redrawn (plan 091). Synchronous, so `renderToString` renders it.
 */
export default function NamePage({ name }: { name: PlanetaryName }) {
  const planet = planetOfName(name);
  const roman = name.name.roman;
  const agrippa = readingOf(name, "agrippa1533");
  const agrippaName = agrippaRoman(name);
  const exception = exceptionOf(name, "agrippa1533");
  const number = squareNumberOf(name);
  const constant = constantOf(planet, number);
  const text = planetaryNameSigilText(name);
  const files = planetaryNameSigilFiles(name);
  const others = otherSpellings(name);
  const character = characterOf(name, "agrippa1533");
  const regardie = characterOf(name, "regardie1940");
  const divided = Boolean(name.division);
  const characterLeaf = character ? leafNumbers(character.leaf)[0] : undefined;
  const liberties = characterLiberties(
    (character && characterStrokes(character)) || [],
  );
  const regardieLeaf = regardie ? leafNumbers(regardie.leaf)[0] : undefined;

  return (
    <EntityFrame>
      <Trail href={kameaPath(planet)}>
        <UiText message={KAMEA_SQUARE_LABELS[planet]} />
      </Trail>
      {/* The trail and the sigil's two files, in one graph. */}
      <JsonLd data={planetaryNameJsonLd(name)} />

      <h1>
        {roman}
        {agrippa?.he ? (
          <>
            {" "}
            <Hebrew>{agrippa.he}</Hebrew>
          </>
        ) : null}
      </h1>

      <Lede>
        <UiText message={NAME_LEDES[name.id]} />
      </Lede>

      <EntityTable>
        <Row label={<UiText message={/*i18n*/ "Name"} />}>
          {roman}
          {agrippaName ? (
            <Muted block>
              <UiText
                message={/*i18n*/ "Agrippa 1533: {name}"}
                values={{ name: agrippaName }}
              />
            </Muted>
          ) : null}
        </Row>
        <Row label={<UiText message={/*i18n*/ "Hebrew"} />}>
          {agrippa?.he ? (
            <>
              <Hebrew>{agrippa.he}</Hebrew>{" "}
              <Muted>
                <UiText message={/*i18n*/ "as Agrippa prints it in 1533"} />
              </Muted>
            </>
          ) : null}
        </Row>
        <Row label={<UiText message={/*i18n*/ "Number"} />}>
          {agrippa?.number !== undefined ? (
            <>
              {number}
              {constant ? (
                <>
                  {", "}
                  <UiText message={CONSTANT_LABELS[constant]} />
                </>
              ) : null}
              {agrippa.count === "finals" ? (
                <Muted block>
                  <UiText
                    message={
                      /*i18n*/ "With the final letters counted at 500 to 900."
                    }
                  />
                </Muted>
              ) : null}
              {exception && number !== agrippa.number ? (
                <Muted block>
                  <UiText
                    message={
                      /*i18n*/ "Agrippa 1533 prints {printed}; his reading below says whose the slip is."
                    }
                    values={{ printed: agrippa.number }}
                  />
                </Muted>
              ) : exception ? (
                <Muted block>
                  <UiText
                    message={
                      /*i18n*/ "Its letters give {expected}; Agrippa 1533's reading below says why."
                    }
                    values={{ expected: exception.expected }}
                  />
                </Muted>
              ) : null}
            </>
          ) : null}
        </Row>
        <Row label={<UiText message={/*i18n*/ "Kamea"} />}>
          <Link href={kameaPath(planet)}>
            <UiText message={KAMEA_SQUARE_LABELS[planet]} />
          </Link>
        </Row>
      </EntityTable>

      <section aria-labelledby="witnesses">
        <H2 id="witnesses">
          <UiText message={/*i18n*/ "The name in each witness"} />
        </H2>
        <p>
          <UiText
            message={
              /*i18n*/ "Each printing's reading of the name, linked to its page: its romanisation or caption, its own spelling where it is not Agrippa's of 1533, and the number it prints, with what its letters give where that differs and whose the difference is."
            }
          />
        </p>
        <NameWitnesses name={name} planet={planet} />
      </section>

      <section aria-labelledby="sigil">
        <H2 id="sigil">
          <UiText message={/*i18n*/ "The sigil"} />
        </H2>
        <p>
          <UiRichText
            message={
              /*i18n*/ "The sigil traces the name's letters on its planet's <0>kamea</0> by the method Regardie sets out in <1>The Golden Dawn</1>, volume 4 (1940), on <2>pages 78 to 80</2>: each letter is counted at its number, a number the square does not have is taken down to its tens or its units, and a line runs through the cells in the order of the letters, from a small circle at the first. The spelling traced is Agrippa's of 1533, with any final letter at its ordinary value."
            }
            components={{
              0: <Link href={kameaPath(planet)} />,
              1: <i />,
              2: <Outside href={regardieMethod} />,
            }}
          />
        </p>
        {divided ? (
          <p>
            <UiText
              message={
                /*i18n*/ "Agrippa prints it as one word of fourteen letters. Dividing it in two, where its romanisation divides it, is ours, and is how this site traces it."
              }
            />
          </p>
        ) : null}
        <TracedSigil id="traced" name={roman} planet={planet} text={text} />
        <p className={styles.actions}>
          <Link href={kameaSigilPagePath({ planet, text, finals: false })}>
            <UiText message={/*i18n*/ "Open in the generator"} />
          </Link>
          {/* Files, not pages: nothing to prefetch. */}
          <Link
            href={files.png.path}
            download={files.png.name}
            prefetch={false}
          >
            <UiText message={/*i18n*/ "Download PNG"} />
          </Link>
          <Link
            href={files.svg.path}
            download={files.svg.name}
            prefetch={false}
          >
            <UiText message={/*i18n*/ "Download SVG"} />
          </Link>
        </p>
      </section>

      {character && characterLeaf !== undefined ? (
        <section aria-labelledby="character">
          <H2 id="character">
            <UiText message={/*i18n*/ "Agrippa's character"} />
          </H2>
          <p>
            <UiRichText
              message={
                /*i18n*/ "Agrippa prints a character for the name beside its planet's square, on <0>page {page}</0> of the 1533 printing, which is in the public domain. Below is the character redrawn from our reading of the woodcut, not a copy of the print."
              }
              values={{ page: AGRIPPA_LEAF_PAGES[characterLeaf] ?? "" }}
              components={{
                0: (
                  <LeafLink
                    leaf={leafRef(
                      WITNESS_ITEMS.agrippa1533,
                      characterLeaf,
                      `${name.id}Character`,
                    )}
                  />
                ),
              }}
            />
          </p>
          <figure className={styles.figure} data-character={character.id}>
            <CharacterDrawing
              character={character}
              labelledBy={`${ID_PREFIX.agrippa1533}-character-label`}
            />
            <figcaption className={styles.caption}>
              <span id={`${ID_PREFIX.agrippa1533}-character-label`}>
                <UiText
                  message={
                    /*i18n*/ "Agrippa's character of {name}, redrawn from our reading of the woodcut"
                  }
                  values={{ name: roman }}
                />
              </span>
              {". "}
              <UiText
                message={
                  /*i18n*/ "Drawn from the strokes recorded by {reader}, one of the two readers: straight between the points it read, curved where it read a curve. A ring is a circle it read at an end or on a line; a bar or a hook is drawn where it placed one; a dashed ring is an end mark it did not name. The woodcut's line weight and rounded turns are not drawn."
                }
                values={{ reader: READER_NAMES[CHARACTER_READER] }}
              />
              {liberties.hookCurve ? (
                <>
                  {" "}
                  <UiText
                    message={
                      /*i18n*/ "The reader placed only the tips of the hook's curls; how they bend is ours."
                    }
                  />
                </>
              ) : null}
              {liberties.markDirection ? (
                <>
                  {" "}
                  <UiText
                    message={
                      /*i18n*/ "The reader did not record which way a bar or hook turns; the direction drawn is ours."
                    }
                  />
                </>
              ) : null}
            </figcaption>
          </figure>
          <Verdict character={character} />

          {regardie && regardieLeaf !== undefined ? (
            <>
              <h3 id="regardie" className={styles.subheading}>
                <UiText message={/*i18n*/ "Regardie's redrawing"} />
              </h3>
              <p>
                <UiRichText
                  message={
                    /*i18n*/ "Regardie's plates in <0>The Golden Dawn</0>, volume 4 (1940), draw the character again, on <1>page {page}</1>. That book is in copyright where this site is read, so his figure is neither shown nor redrawn here; this is our reading of it."
                  }
                  values={{ page: regardiePage(regardieLeaf) }}
                  components={{
                    0: <i />,
                    1: (
                      <Outside
                        href={
                          leafRef(WITNESS_ITEMS.regardie1940, regardieLeaf).href
                        }
                      />
                    ),
                  }}
                />
              </p>
              <Verdict character={regardie} />
            </>
          ) : null}

          <p className={styles.note}>
            <UiRichText
              message={
                /*i18n*/ "How this was read: each figure was cropped from the scan and given a number in place of its name. Two readers, Claude Opus 5.5 and Claude Fable 5.2, working apart, recorded its strokes, the points along them and the marks at their ends. Two judges, the same two models working apart, then compared each figure and both readings with the trace of every witness's spelling. Where the judges agreed, their verdict stands; where they differed, on 7 of the 32 figures, Claude Opus 5.5 weighed both judges' reasons against the figure and settled it, and the note with the verdict says how. The readings and verdicts are in the <0>table of Agrippa's characters</0>."
              }
              components={{
                0: (
                  <Link
                    href={rowHref("planetaryNameCharacter", character.id)}
                  />
                ),
              }}
            />
          </p>
        </section>
      ) : null}

      {others.length ? (
        <section aria-labelledby="other-spellings">
          <H2 id="other-spellings">
            <UiText message={/*i18n*/ "Other witnesses' spellings"} />
          </H2>
          <p>
            <UiText
              message={
                /*i18n*/ "Where another witness spells the name so that it traces otherwise, and no note above calls that spelling a slip, its trace too, by the same method."
              }
            />
          </p>
          {others.map((other, index) => (
            <div key={other.he} data-spelling={other.he}>
              <p>
                {other.witnesses.map((witness, i) => (
                  <span key={witness}>
                    {i ? ", " : null}
                    <UiText message={WITNESS_LABELS[witness]} />
                  </span>
                ))}
                {": "}
                <Hebrew>{other.he}</Hebrew>{" "}
                <Link
                  href={kameaSigilPagePath({
                    planet,
                    text: other.he,
                    finals: false,
                  })}
                >
                  <UiText message={/*i18n*/ "Open in the generator"} />
                </Link>
              </p>
              {other.unsettled.map((exception) => (
                <p
                  key={exception.id}
                  className={styles.note}
                  data-unsettled={exception.id}
                >
                  <UiText
                    message={
                      /*i18n*/ "Whose this spelling is, the evidence read does not settle:"
                    }
                  />{" "}
                  <span lang="en">{exception.note}</span>
                </p>
              ))}
              <TracedSigil
                id={`other-${index}`}
                name={roman}
                planet={planet}
                text={other.he}
              />
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="see-also">
        <H2 id="see-also">
          <UiText message={/*i18n*/ "See also"} />
        </H2>
        <ul className={styles.list}>
          <li>
            <Link href={kameaPath(planet)}>
              <UiText message={KAMEA_SQUARE_LABELS[planet]} />
            </Link>
          </li>
          <li>
            <Link href={`/astrology/planet/${planet}`}>
              <UiText message={/*i18n*/ "The planet's correspondences"} />
            </Link>
          </li>
          <li>
            <Link href={`${KAMEA_HUB_PATH}/sigils?planet=${planet}`}>
              <UiText message={/*i18n*/ "Kamea Sigil Generator"} />
            </Link>
          </li>
          <li>
            <Link href={KAMEA_HUB_PATH}>
              <UiText message={/*i18n*/ "All seven kameas"} />
            </Link>
          </li>
        </ul>
      </section>
    </EntityFrame>
  );
}
