"use client";

import "@/../public/fonts/NotoSansCoptic.css";
import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import {
  pyramidExceptions,
  pyramidReading,
  pyramidRules,
  sourceText,
  sourceUrl,
  type TabletSource,
  type TabletWorkId,
} from "magick-data/enochian/tabletNotes";
import {
  CALVARY_BARS,
  type TabletPyramid,
} from "magick-data/enochian/tabletPyramids";
import type { TabletVersionId } from "magick-data/enochian/tablets";
import godForms, {
  type GDGodForm,
  type GDGodFormId,
} from "magick-data/gd/godForms";
import sephirot from "magick-data/kabbalah/sephirot";
import React from "react";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiRichText from "@/i18n/UiRichText";
import Cite from "@/sources/Cite";
import { WORKS, type WorkId } from "@/sources/works";
import { displayName, squareInWords, type Translate } from "./nameWords";
import PyramidDrawing from "./PyramidDrawing";
import {
  godInWords,
  listWords,
  regionInWords,
  sideInWords,
  sphinxInWords,
} from "./pyramidWords";
import styles from "./tablets.module.css";

/** The notes' works that the site's citations know (`src/sources/works.ts`). */
const CITED_WORKS: Partial<Record<TabletWorkId, WorkId>> = {
  regardie1937: "regardie1937",
  regardie1939: "regardie1939",
  regardie1940: "regardie1940",
  equinox1912: "equinoxI7",
};

/**
 * The works a note cites, each once, with its pages and plates linked by
 * leaf through `<Cite>` (AGENTS.md, "Reference work", rule 4).
 */
function Cited({
  sources,
  t,
}: {
  sources: readonly TabletSource[];
  t: Translate;
}) {
  const works = [...new Set(sources.map((source) => source.work))];
  return (
    <Typography component="ul" variant="body2" sx={{ pl: 3, mt: 0.5 }}>
      {works.map((work) => {
        const cited = CITED_WORKS[work];
        const places = sources.filter((source) => source.work === work);
        if (!cited)
          return places.map((source) => {
            const url = sourceUrl(source);
            const text = sourceText(source);
            return (
              <li key={text}>
                {url ? (
                  <a href={url} rel="noreferrer">
                    {text}
                  </a>
                ) : (
                  text
                )}
              </li>
            );
          });
        return (
          <li key={work}>
            {WORKS[cited].title}:{" "}
            {places.map((source, index) => (
              <React.Fragment key={`${source.plate ?? source.page}`}>
                {index > 0 && ", "}
                {source.leaf ? (
                  <Cite work={cited} leaf={source.leaf} plain rel="noreferrer">
                    {placeOf(source, t)}
                  </Cite>
                ) : (
                  placeOf(source, t)
                )}
              </React.Fragment>
            ))}
          </li>
        );
      })}
    </Typography>
  );
}

/** "p.291", "Plate IV". */
const placeOf = (source: TabletSource, t: Translate) =>
  source.plate
    ? t(/*i18n*/ "Plate {plate}", { plate: source.plate })
    : t(/*i18n*/ "p.{page}", { page: source.page ?? "" });

/** A note of ours or a source's, with its citations. */
function Note({
  text,
  sources,
  t,
}: {
  text: string;
  sources: readonly TabletSource[];
  t: Translate;
}) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2">{text}</Typography>
      <Cited sources={sources} t={t} />
    </Box>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" component="h4" sx={{ mt: 2 }}>
      {children}
    </Typography>
  );
}

/** Where vol. 4 gives the sides' colours and the symbols' facing. */
const PAINTED: readonly TabletSource[] = [
  { work: "regardie1940", page: 295, leaf: 287 },
];

/** A Sephirah by its name and number: "Gevurah (5)". */
const sephirahWords = (id: keyof typeof sephirot, t: Translate) =>
  t(/*i18n*/ "{sephirah} ({number})", {
    sephirah: sephirot[id].name.roman,
    number: sephirot[id].index,
  });

/**
 * A Calvary square's Sephirah, and the dispute over the bar's order
 * (plan 095, decision 2): what the other layout puts here.
 */
function CalvarySephirah({
  pyramid,
  version,
  worked,
  t,
}: {
  pyramid: TabletPyramid;
  version: TabletVersionId;
  /**
   * Whether vol. 4's worked square, the O of OMEBB, is this one and puts
   * the other layout's Sephirah here (`vol4Omebb`).
   */
  worked: boolean;
  t: Translate;
}) {
  const id = pyramid.sides[3].attribution.sephirahId;
  if (!id) return null;
  const top = pyramid.row < 6 ? 0 : 7;
  const left = pyramid.column < 5 ? 0 : 7;
  const onBar = pyramid.row - top === 1;
  const equinox = version === "equinox";
  const other = (equinox ? CALVARY_BARS.gd : CALVARY_BARS.equinox)?.[
    pyramid.column - left
  ];
  const sephirah = sephirahWords(id, t);
  const reading = pyramidReading("calvaryBar");
  return (
    <>
      <Heading>{t(/*i18n*/ "Its Sephirah")}</Heading>
      <Typography variant="body2">
        {t(/*i18n*/ "Its Sephirah is {sephirah}.", { sephirah })}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }} data-dispute="">
        {!onBar
          ? t(
              /*i18n*/ "Every witness puts {sephirah} here: only the order of the bar is disputed.",
              { sephirah },
            )
          : !other || other === id
            ? t(
                /*i18n*/ "The order of the bar is disputed, but every witness puts {sephirah} here, where the bar crosses the column.",
                { sephirah },
              )
            : equinox
              ? t(
                  /*i18n*/ "The order of the bar is disputed. This version follows the Equinox's plates; vol. 4's diagram and vol. 1's badge put {other} here.",
                  { other: sephirahWords(other, t) },
                )
              : worked
                ? t(
                    /*i18n*/ "The order of the bar is disputed. This version follows vol. 4's diagram and vol. 1's badge; the Equinox's plates put {other} here, and so does vol. 4's own worked example of this square, the O of OMEBB.",
                    { other: sephirahWords(other, t) },
                  )
                : t(
                    /*i18n*/ "The order of the bar is disputed. This version follows vol. 4's diagram and vol. 1's badge; the Equinox's plates put {other} here.",
                    { other: sephirahWords(other, t) },
                  )}
      </Typography>
      {reading && (
        <Typography
          component="details"
          variant="body2"
          sx={{ mt: 1 }}
          data-dispute-why=""
        >
          <summary className={styles.disclosure}>
            {t(/*i18n*/ "Why the bar's order is disputed")}
          </summary>
          <Note text={reading.text} sources={reading.sources} t={t} />
        </Typography>
      )}
    </>
  );
}

/** A servient square's god: the mix, the station, the Coptic, vol. 3. */
function God({ pyramid, t }: { pyramid: TabletPyramid; t: Translate }) {
  const id = pyramid.godFormId as GDGodFormId | undefined;
  if (!id) return null;
  const god: GDGodForm = godForms[id];
  const children = god.mix === "three" ? pyramidReading("children") : undefined;
  const [rule] = pyramidRules("gods");
  return (
    <>
      <Heading>{t(/*i18n*/ "Its god")}</Heading>
      <Typography variant="body2">{godInWords(pyramid, t)}</Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {t(/*i18n*/ "{god}'s station in the Neophyte grade: {station}.", {
          god: god.name.en,
          station: god.station.en,
        })}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {t(/*i18n*/ "In Coptic, as the table spells it:")}{" "}
        <span lang="cop" className={styles.coptic} data-coptic="">
          {god.coptic}
          {god.st && " (ⲋ)"}
        </span>
      </Typography>
      {god.st && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          <UiRichText
            message={
              /*i18n*/ "The table adds <0>ⲋ</0> to the name, a sign it reads as st and gives to Keter, for the god's more spiritual form."
            }
            components={{
              0: <span lang="cop" className={styles.coptic} data-sou="" />,
            }}
          />
        </Typography>
      )}
      {god.copticNote && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t(/*i18n*/ "Our reading of the Coptic: {note}", {
            note: god.copticNote.en,
          })}
        </Typography>
      )}
      {god.note && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {god.note.en}
        </Typography>
      )}
      {(god.vol3 ?? []).map((reading) => (
        <Box key={reading.leaf} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            {t(/*i18n*/ "Vol. 3 differs: {note}", { note: reading.note.en })}
          </Typography>
          <Cited
            sources={[
              { work: "regardie1939", page: reading.page, leaf: reading.leaf },
            ]}
            t={t}
          />
        </Box>
      ))}
      {rule && <Note text={rule.text} sources={rule.sources} t={t} />}
      {children && (
        <Note text={children.text} sources={children.sources} t={t} />
      )}
    </>
  );
}

/** A servient square's sphinx, by side, with the source's rule. */
function Sphinx({ pyramid, t }: { pyramid: TabletPyramid; t: Translate }) {
  const sentences = sphinxInWords(pyramid, t);
  if (!sentences.length) return null;
  const readings = ["sphinx", "tendency"].flatMap(
    (id) => pyramidReading(id) ?? [],
  );
  return (
    <>
      <Heading>{t(/*i18n*/ "Its sphinx")}</Heading>
      <Typography
        component="ul"
        variant="body2"
        sx={{ pl: 3, my: 0.5 }}
        data-sphinx=""
      >
        {sentences.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </Typography>
      {readings.map((reading) => (
        <Note
          key={reading.id}
          text={reading.text}
          sources={reading.sources}
          t={t}
        />
      ))}
    </>
  );
}

/**
 * A square's pyramid (plan 095, decision 3): where it lies and the
 * letters of the Name that govern it, its pyramid drawn large with every
 * side in words, the rule it follows with its witnesses, where a witness
 * departs from it here, and on a Calvary square its Sephirah and the
 * dispute over the bar; on a servient square its angels, god and sphinx.
 */
export default function PyramidDetail({
  tablet,
  version,
  pyramid,
  letter,
  heading,
  outward,
  setOutward,
}: {
  tablet: string;
  version: TabletVersionId;
  pyramid: TabletPyramid;
  /** The square's letter in the chosen version. */
  letter: string;
  /** The detail's heading, which a choice made by keyboard focuses. */
  heading: React.RefObject<HTMLHeadingElement | null>;
  /** Whether the symbols face outward, as the Order painted them. */
  outward: boolean;
  setOutward: (outward: boolean) => void;
}) {
  const { t, locale } = useUiLanguage();
  const list = listWords(locale);
  const square = { row: pyramid.row, column: pyramid.column };
  const rules = pyramidRules(pyramid.region);
  const exceptions = pyramidExceptions(tablet).filter(
    (exception) =>
      (!exception.versions ||
        (exception.versions as readonly string[]).includes(version)) &&
      exception.squares.some(
        (each) =>
          each.tablet === tablet &&
          each.row === pyramid.row &&
          each.column === pyramid.column,
      ),
  );
  const readings = [
    pyramid.region === "servient" ? "geomanticFigures" : "",
    pyramid.sides[0].attribution.planetId === "saturn" &&
    pyramid.region === "servient"
      ? "earthAsSaturn"
      : "",
  ].flatMap((id) => (id ? (pyramidReading(id) ?? []) : []));
  return (
    <Box data-pyramid-detail="">
      <Typography
        variant="h6"
        component="h3"
        ref={heading}
        tabIndex={-1}
        className={styles.namesItem}
        sx={{ mt: 1, "&:focus": { outline: "none" } }}
      >
        {squareInWords(square, t)}
      </Typography>
      <Typography variant="body2">
        {regionInWords(pyramid, tablet, t)}
      </Typography>
      <Box className={`${plateClass} ${styles.pyramid}`} sx={{ my: 1.5 }}>
        <PyramidDrawing pyramid={pyramid} letter={letter} outward={outward} />
      </Box>
      <FormControlLabel
        className={styles.touchable}
        control={
          <Switch
            checked={outward}
            onChange={(event) => setOutward(event.target.checked)}
          />
        }
        label={t(
          /*i18n*/ "Face the symbols outward, as the Order painted them",
        )}
      />
      <Heading>{t(/*i18n*/ "Its four sides")}</Heading>
      <Typography
        component="ul"
        variant="body2"
        sx={{ pl: 3, my: 0.5 }}
        data-sides=""
      >
        {pyramid.sides.map((side) => (
          <li key={side.side}>{sideInWords(side, t, list)}</li>
        ))}
      </Typography>
      <Box sx={{ mt: 0.5 }} data-orientation="">
        <Typography variant="body2">
          {outward
            ? t(
                /*i18n*/ "Each side is drawn in its element's colour, with its symbol in the complementary colour, facing outward, as the Order painted them. The top holds the square's letter, {letter}.",
                { letter },
              )
            : t(
                /*i18n*/ "Each side is drawn in its element's colour, with its symbol in the complementary colour, upright so that it can be read; the Order painted the symbols facing outward. The top holds the square's letter, {letter}.",
                { letter },
              )}
        </Typography>
        <Cited sources={PAINTED} t={t} />
      </Box>
      {pyramid.region === "calvaryCross" && (
        <CalvarySephirah
          pyramid={pyramid}
          version={version}
          worked={exceptions.some((exception) => exception.id === "vol4Omebb")}
          t={t}
        />
      )}
      {pyramid.angel && (
        <>
          <Heading>{t(/*i18n*/ "Its angels")}</Heading>
          <Typography variant="body2">
            {t(
              /*i18n*/ "Its angel is {angel}: the servient name of its row, read from this square.",
              { angel: displayName(pyramid.angel.spelling) },
            )}
          </Typography>
          {pyramid.greatAngel?.unionLetter && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t(
                /*i18n*/ "Its great angel is {angel}, with {letter} of the Tablet of Union before it.",
                {
                  angel: displayName(pyramid.greatAngel.spelling),
                  letter: pyramid.greatAngel.unionLetter.letter,
                },
              )}
            </Typography>
          )}
        </>
      )}
      <God pyramid={pyramid} t={t} />
      <Sphinx pyramid={pyramid} t={t} />
      <Heading>{t(/*i18n*/ "The rule it follows")}</Heading>
      {rules.map((rule) => (
        <Note
          key={rule.witness}
          text={rule.text}
          sources={rule.sources}
          t={t}
        />
      ))}
      {readings.map((reading) => (
        <Note
          key={reading.id}
          text={reading.text}
          sources={reading.sources}
          t={t}
        />
      ))}
      {exceptions.length > 0 && (
        <>
          <Heading>
            {t(/*i18n*/ "Where a witness departs from it here")}
          </Heading>
          {exceptions.map((exception) => (
            <Note
              key={exception.id}
              text={exception.text}
              sources={exception.sources}
              t={t}
            />
          ))}
        </>
      )}
    </Box>
  );
}
