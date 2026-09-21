"use client";
import { ExpandMore } from "@mui/icons-material";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import React from "react";
import zodiacs from "@/../data/astrology/Zodiac";
import christianChoirs from "@/../data/kabbalah/ChristianChoirs";
import angels, { type Angel } from "@/../data/kabbalah/SeventyTwoAngels";
import {
  loadAngelTexts,
  type TextLanguage,
} from "@/../data/kabbalah/SeventyTwoAngelsText";
import {
  choirOf,
  governedDaysOf,
  type MonthDay,
  presidingDaysOf,
  signOf,
} from "@/../data/kabbalah/seventyTwoAngelsDerived";

type AstrologySystem = "tropical" | "sidereal";

const formatter = new Intl.DateTimeFormat("default", {
  month: "short",
  day: "numeric",
});

/** Lenain's days belong to the year, not to one of them; 2001 is a common year. */
function formatMonthDay([month, day]: MonthDay) {
  return formatter.format(new Date(2001, month - 1, day));
}

/**
 * Lenain's year opens at the first degree of Aries on 20 March, which is where
 * the tropical zodiac puts it. Fagan-Bradley puts that degree 26 days later, so
 * a sidereal reading shifts the whole circle by as much.
 * https://masteringthezodiac.com/sidereal-astrology
 */
const shiftDaysBySystem: Record<AstrologySystem, number> = {
  tropical: 0,
  sidereal: 26, // 15 April
};

function governedRange(no: number, astrologySystem: AstrologySystem) {
  const { from, to } = governedDaysOf(no, shiftDaysBySystem[astrologySystem]);
  return `${formatMonthDay(from)} - ${formatMonthDay(to)}`;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules
const enOrdinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });
const suffixes = new Map([
  ["one", "st"],
  ["two", "nd"],
  ["few", "rd"],
  ["other", "th"],
]);
const formatOrdinals = (n: number) =>
  `${n}${suffixes.get(enOrdinalRules.select(n))}`;

function Governs({
  no,
  astrologySystem,
}: {
  no: number;
  astrologySystem: AstrologySystem;
}) {
  const sign = signOf(no);

  return (
    <>
      {sign.from}-{sign.to}° of {zodiacs[sign.zodiacId].name.en} (
      {formatOrdinals(sign.quinance)} quinance)
      <br />
      {governedRange(no, astrologySystem)}
    </>
  );
}

function Said({
  label,
  children,
  width,
}: {
  label: string;
  children: React.ReactNode;
  width?: number;
}) {
  if (!children) return null;
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={width ? { width } : undefined}>
        {label}
      </TableCell>
      <TableCell>{children}</TableCell>
    </TableRow>
  );
}

/**
 * The entries run to about 88kB a language, so they load when a reader opens
 * one rather than with the page, as the Mercury widget's ephemeris does.
 */
function OriginalText({ no }: { no: number }) {
  const [open, setOpen] = React.useState(false);
  const [language, setLanguage] = React.useState<TextLanguage>("en");
  const [texts, setTexts] = React.useState<string[]>();

  React.useEffect(() => {
    if (!open) return;
    let current = true;
    setTexts(undefined);
    loadAngelTexts(language)
      .then((loaded) => {
        if (current) setTexts(loaded);
      })
      .catch((error) => {
        console.error(error);
        if (current) setTexts([]);
      });
    return () => {
      current = false;
    };
  }, [open, language]);

  return (
    <details
      style={{ fontSize: "80%" }}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Original text</summary>
      {open && (
        <>
          <RadioGroup
            row
            value={language}
            onChange={(e) => setLanguage(e.target.value as TextLanguage)}
            sx={{ mt: 1 }}
          >
            <FormControlLabel
              value="en"
              control={<Radio size="small" />}
              label="English"
            />
            <FormControlLabel
              value="fr"
              control={<Radio size="small" />}
              label="Français (Lenain)"
            />
          </RadioGroup>
          <div
            style={{
              marginTop: ".8em",
              whiteSpace: "pre-wrap",
              textAlign: "justify",
            }}
          >
            {texts ? (texts[no - 1] ?? "") : "Loading…"}
          </div>
        </>
      )}
    </details>
  );
}

function Angel({
  angel,
  no,
  astrologySystem,
}: {
  angel: Angel;
  no: number;
  astrologySystem: AstrologySystem;
}) {
  const choir = christianChoirs[choirOf(no) - 1];

  return (
    <Accordion slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary
        expandIcon={<ExpandMore />}
        aria-controls={`angel-${no}-content`}
        id={`angel-${no}-header`}
      >
        <Typography>
          {no}. {angel.name.en} ({governedRange(no, astrologySystem)})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer component={Paper}>
          <Table aria-label="simple table" size="small">
            <TableBody>
              <Said label="Angel (genius):" width={150}>
                {angel.name.en}
              </Said>
              <Said label="Attribute:" width={150}>
                {angel.attribute.en}
              </Said>
              <Said label="Rules:" width={150}>
                {angel.people.en}
              </Said>
              <Said label="God Name:" width={150}>
                {angel.godName}
              </Said>
              <Said label="Choir:">{choir.name.en}</Said>
              <Said label="Governs:">
                <Governs no={no} astrologySystem={astrologySystem} />
              </Said>
              <Said label="Presiding Days:">
                {presidingDaysOf(no).map(formatMonthDay).join(", ")}
              </Said>
              <Said label="Invoked for:">{angel.invokedFor.en}</Said>
              <Said label="Influences:">{angel.governs.en}</Said>
              <Said label="Born under:">{angel.bornUnder.en}</Said>
              <Said label="Contrary genius:">{angel.contrary.en}</Said>
              <Said label="Psalm:">
                {angel.psalm.psalm > 0 &&
                  `${angel.psalm.psalm}:${angel.psalm.verse}${
                    angel.psalm.la ? ` — ${angel.psalm.la}` : ""
                  }`}
              </Said>
            </TableBody>
          </Table>
        </TableContainer>
        <br />
        <OriginalText no={no} />
      </AccordionDetails>
    </Accordion>
  );
}

function SevenyTwo() {
  const [astrologySystem, setAstrologySystem] =
    React.useState<AstrologySystem>("tropical");

  return (
    <>
      <Container style={{ textAlign: "justify" }}>
        <details style={{ fontSize: "80%", marginTop: "1em" }}>
          <summary>What is this?</summary>
          <p style={{ fontSize: "80%" }}>
            In Christian Kabbalah, Johann Reuchlin (1455–1522) considered the 72
            names - made pronounceable by adding the suffixes &quot;El&quot; or
            &quot;Yah&quot; - to be the names of angels: individuated products
            of God&apos;s will. He lists these &quot;72 Angels of the Shem
            HaMephorash&quot; in his <i>De Arte Cabbalistica</i> (1517), which
            greatly influenced later Hermetic works including those of the
            Golden Dawn. More info on the{" "}
            <a
              target="_blank"
              href="https://en.wikipedia.org/wiki/Shem_HaMephorash"
            >
              Shem HaMephorash
            </a>{" "}
            wikipedia page.
          </p>
        </details>
        <details style={{ fontSize: "80%", marginTop: "1em" }}>
          <summary>Important note on sources used.</summary>
          <p>
            The material here is taken from{" "}
            <a href="https://www.google.co.uk/books/edition/La_science_cabalistique/ZqgpxTZ43HkC?hl=en&gbpv=0">
              <i>La Science Cabalistique</i>
            </a>{" "}
            by Lazare Lenain (1823; digitized by Google Books), or, as his title
            page has it in full,{" "}
            <i>
              the Cabalistic Science, or the Art of Knowing the Good Genii who
              influence the destiny of men
            </i>
            . It is read from the scan itself, page by page, rather than from an
            OCR of it: that OCR could not read Lenain&apos;s Hebrew at all, and
            read many of his digits as letters. The whole book is here as a{" "}
            <Link href="/books/la-science-cabalistique">reading edition</Link>,
            footnotes, tables and all, and{" "}
            <a href="/docs/Lenain - La Science Cabalistique (1823).md">
              as Markdown
            </a>
            .
          </p>
          <p>
            The French beside each translation is what he printed, so you can
            read what the English was made from. The English is translated from
            that French and from nothing else.
          </p>
          <p>
            Lenain makes mistakes, and where he does the text keeps his words
            and a note says what is wrong — an impossible 31 April, a genius
            numbered 36 in the middle of the forties, five revolutions of 72
            days called 260. The tables on this page use the corrected value.
            Most of those notes found themselves: his own four tables say what
            each entry should contain, so a disagreement is arithmetic rather
            than opinion.
          </p>
          <p>
            The Hebrew was the hard part. He dots his letters above rather than
            within, and a machine reading those dots as vowel points loses
            letters or invents them. Forty-seven names are given here because
            two independent readings of the scan agree on them; the other
            twenty-five were read by a person who reads Hebrew. Each name is
            given both as Lenain points it and as its bare letters.
          </p>
          <p>
            The scan is not of the 1823 printing but of a later reissue, which
            reproduces Lenain&apos;s title page &mdash;{" "}
            <i>
              A Amiens, chez l&apos;Auteur, au Cabinet de lecture, place
              Saint-Firmin, N. 1. 1823
            </i>{" "}
            &mdash; and adds a preface by Papus for the Ordre Kabbalistique de
            la Rose-Croix. The volume does not date itself; the first reprint is
            recorded as Dujols and Thomas, 1909.
          </p>
          <p>
            Lenain died in 1877 and Papus in 1916, so both texts are public
            domain, and no rights are asserted over either. The reading, the
            translation and the arrangement are{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>{" "}
            with the rest of the{" "}
            <a href="https://github.com/gadicc/magickly/tree/main/data">data</a>
            , and no rights are claimed where none subsist. This was done in an
            effort to provide a Copyright-free version of this material,
            however, a much better translation exists:
          </p>
          <p>
            We highly recommend the{" "}
            <a href="https://www.amazon.co.uk/Science-Kabbalah-Lazare-Lenain/dp/1947907093/ref=sr_1_1?crid=L3H786IAH9D0&keywords=the+science+of+the+kabbalah&qid=1695585748&sprefix=the+science+of+the+kabbalah%2Caps%2C121&sr=8-1">
              translation by Piers A. Vaughan
            </a>{" "}
            (Amazon link), who has not only provided an outstanding work, but
            also provided free, high quality images of the sigils on his blog,
            in{" "}
            <a href="https://rosecirclebooks.com/the-science-of-the-kabbalah-lenain/">
              this post
            </a>{" "}
            and{" "}
            <a href="https://rosecirclebooks.com/levi-seals-for-shemhamephorash/">
              this post
            </a>
            . Nothing here is derived from his translation; it was consulted
            only to check names against Lenain&apos;s own first table, whose
            fold-out leaf this scan photographed folded.
          </p>
        </details>
        <p>The sigils will be added at a later time.</p>
      </Container>
      <Container>
        <FormControl>
          <FormLabel id="astrology-radio-buttons-group">Astrology</FormLabel>
          <RadioGroup
            row
            aria-labelledby="astrology-radio-buttons-group"
            value={astrologySystem}
            onChange={(e) =>
              setAstrologySystem(e.target.value as AstrologySystem)
            }
          >
            <FormControlLabel
              value="tropical"
              control={<Radio />}
              label="Tropical"
            />
            <FormControlLabel
              value="sidereal"
              control={<Radio />}
              label="Sidereal (Fagan-Bradley)"
            />
          </RadioGroup>
        </FormControl>
      </Container>
      {/*
        The list runs edge to edge on a phone, which is what it was drawn for,
        and lines up with the prose above it from a tablet upwards — where a
        full-bleed row otherwise leaves the name and its chevron at opposite
        ends of the window.
      */}
      <Container disableGutters sx={{ mt: "1em", px: { xs: 0, sm: 2 } }}>
        {angels.map((angel) => (
          <Angel
            key={angel.no}
            angel={angel}
            no={angel.no}
            astrologySystem={astrologySystem}
          />
        ))}
      </Container>
      <br />
      <Container sx={{ fontSize: "80%", textAlign: "justify" }}>
        Magick.ly is open-source. You can see the code used to generate this
        page{" "}
        <a href="https://github.com/gadicc/magickly/blob/main/src/app/kabbalah/yhvh/72angels/angels.tsx">
          here
        </a>
        . Additionally, see the{" "}
        <a href="https://github.com/gadicc/magickly/blob/main/data/kabbalah/seventyTwoAngels.json5">
          data file
        </a>{" "}
        and the full{" "}
        <Link href="/books/la-science-cabalistique">reading edition</Link> of
        the book.
      </Container>
    </>
  );
}

export default SevenyTwo;
