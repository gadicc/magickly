"use client";
import { Clear } from "@mui/icons-material";
import {
  Box,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
} from "@mui/material";
import {
  KameaSigil,
  type KameaSigilFigure,
  KameaSigilImage,
} from "magick-components/astrology/KameaSigil";
import React from "react";
import ExportControls from "@/export/ExportControls";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import { parseComponentImageRequest } from "@/render/componentImageRequest";
import {
  KAMEA_IMAGE_PLANETS,
  type KameaImagePlanet,
} from "@/render/contracts/kamea";
import {
  canonicalKameaSigilText,
  KAMEA_SIGIL_LETTERS,
  KAMEA_SIGIL_MAX_LETTERS,
} from "@/render/contracts/kameaSigil";
import { KAMEA_PLANET_LABELS, KAMEA_SQUARE_LABELS } from "../kameaPlanets";
import ReductionTable from "../ReductionTable";
import { type KameaSigilState, kameaSigilPagePath } from "./kameaSigilState";
import styles from "./kameaSigils.module.css";
import { kameaSigilNames, WITNESS_LABELS } from "./names";
import { reduceOnKamea } from "./reduction";
import { useKameaSigil } from "./useKameaSigil";

/** Each planet as the picker names it, in the Chaldean order. */
const PLANET_LABELS = KAMEA_PLANET_LABELS;

/** A sigil's accessible name, by its square's planet. */
const SIGIL_LABELS: Record<KameaImagePlanet, string> = {
  saturn: /*i18n*/ "Sigil of {text} on the Kamea of Saturn",
  jupiter: /*i18n*/ "Sigil of {text} on the Kamea of Jupiter",
  mars: /*i18n*/ "Sigil of {text} on the Kamea of Mars",
  sol: /*i18n*/ "Sigil of {text} on the Kamea of the Sun",
  venus: /*i18n*/ "Sigil of {text} on the Kamea of Venus",
  mercury: /*i18n*/ "Sigil of {text} on the Kamea of Mercury",
  luna: /*i18n*/ "Sigil of {text} on the Kamea of the Moon",
};

/** A bare square's accessible name. */
const SQUARE_LABELS = KAMEA_SQUARE_LABELS;

/** The name whose division into two words is ours (decision 10). */
const DIVIDED_NAME = "schedbarschemoth-schartathan";

/**
 * The kamea sigil generator (plan 093, decision 9): a planet, a Hebrew
 * name typed or chosen from the planet's names, final letters counted or
 * not; the sigil over the square, the table of the reduction, and the
 * downloads through the `kamea-sigil` image route. Placement runs in a
 * worker (`useKameaSigil`), since a name it cannot clear takes seconds;
 * the reduction table is worked out at once. `seed`, the server's figure
 * for the initial state where it can bound the work (`serverSeed`), puts
 * the sigil in the page's HTML. Like `/gd/sigils`, the text is the
 * reader's own: the page reads a shared link but never writes the URL.
 */
export default function KameaSigils({
  initial,
  seed = null,
}: {
  initial: KameaSigilState;
  seed?: KameaSigilFigure | null;
}) {
  const { t } = useUiLanguage();
  const ref = React.useRef<SVGSVGElement | null>(null);
  const [planet, setPlanet] = React.useState(initial.planet);
  const [text, setText] = React.useState(initial.text);
  const [finals, setFinals] = React.useState(initial.finals);

  // Whitespace separates words; anything but the 27 letters is refused,
  // as the image route refuses it, and marked.
  const charsValid = [...text].map(
    (character) =>
      /\s/.test(character) || KAMEA_SIGIL_LETTERS.includes(character),
  );
  const letterCount = [...text].filter((character) =>
    KAMEA_SIGIL_LETTERS.includes(character),
  ).length;
  const tooLong = letterCount > KAMEA_SIGIL_MAX_LETTERS;
  const canonical = canonicalKameaSigilText(text);
  const drawn = canonical ?? "";

  const { sigil, pending, placing, error } = useKameaSigil(
    planet,
    drawn,
    finals,
    seed,
  );
  // The figure for what is asked, or the last one while the new one is
  // placed: drawn from its own planet, text and finals, so `KameaSigil`
  // never places on the main thread.
  const current =
    sigil &&
    sigil.planet === planet &&
    sigil.text === drawn &&
    sigil.finals === finals
      ? sigil
      : null;
  const shown = sigil ?? null;

  const names = React.useMemo(() => kameaSigilNames(planet), [planet]);
  const chosen = names.findIndex((name) => name.he === text);
  /** A drawing's accessible name, in the page's language. */
  const labelOf = (
    figure: KameaSigilFigure | null,
    square: KameaImagePlanet,
  ) =>
    figure?.text
      ? t(SIGIL_LABELS[figure.planet as KameaImagePlanet], {
          text: figure.text,
        })
      : t(SQUARE_LABELS[square]);
  const reduction = React.useMemo(
    () => reduceOnKamea(planet, drawn, finals),
    [planet, drawn, finals],
  );

  // The image route's link for what is drawn; none for an empty or
  // refused text, or until its figure is placed here.
  const link = (() => {
    if (!canonical || !current) return undefined;
    try {
      const params = new URLSearchParams({ planet, text: canonical });
      if (finals) params.set("finals", "true");
      return {
        slug: "kamea-sigil" as const,
        props: parseComponentImageRequest("kamea-sigil", params).props,
      };
    } catch {
      return undefined;
    }
  })();

  return (
    <Container sx={{ py: 2 }}>
      <Box
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}
      >
        <TextField
          select
          size="small"
          label={t(/*i18n*/ "Planet")}
          value={planet}
          onChange={(event) =>
            setPlanet(event.target.value as KameaImagePlanet)
          }
          sx={{ minWidth: 140 }}
        >
          {KAMEA_IMAGE_PLANETS.map((id) => (
            <MenuItem key={id} value={id}>
              <UiText message={PLANET_LABELS[id]} />
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t(/*i18n*/ "Names")}
          value={chosen === -1 ? "" : String(chosen)}
          onChange={(event) => {
            const name = names[Number(event.target.value)];
            if (name) setText(name.he);
          }}
          sx={{ minWidth: 200, maxWidth: "100%" }}
        >
          {names.map((name, i) => (
            <MenuItem
              // biome-ignore lint/suspicious/noArrayIndexKey: one name may be listed in two spellings
              key={i}
              value={String(i)}
            >
              {name.witness
                ? `${name.roman} (${t(WITNESS_LABELS[name.witness])})`
                : name.roman}{" "}
              <span lang="he" dir="rtl" className={styles.hebrew}>
                {name.he}
              </span>
            </MenuItem>
          ))}
        </TextField>
        <TextField
          placeholder={t(/*i18n*/ "Hebrew name")}
          size="small"
          value={text}
          onChange={(event) => setText(event.target.value)}
          slotProps={{
            htmlInput: {
              dir: "rtl",
              lang: "he",
              className: styles.hebrewInput,
              "aria-label": t(/*i18n*/ "Hebrew name"),
            },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t(/*i18n*/ "Clear")}
                    onClick={() => setText("")}
                  >
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControlLabel
          control={
            <Checkbox checked={finals} onChange={() => setFinals(!finals)} />
          }
          label={
            <UiText message={/*i18n*/ "Count final letters at 500 to 900"} />
          }
        />
      </Box>
      <div>
        <UiText
          message={
            /*i18n*/ "Separate words with spaces: each word is its own figure, on its own square, drawn right to left."
          }
        />
      </div>
      {names[chosen]?.id === DIVIDED_NAME && !names[chosen].witness && (
        <div>
          <UiText
            message={
              /*i18n*/ "Agrippa prints the spirit of spirits as one word of fourteen letters; it is divided here as its romanisation divides it, Schedbarschemoth Schartathan, and that division is ours."
            }
          />
        </div>
      )}
      {tooLong && (
        <div>
          <UiText
            message={
              /*i18n*/ "A sigil takes at most {max} letters; this text has {count}."
            }
            values={{ max: KAMEA_SIGIL_MAX_LETTERS, count: letterCount }}
          />
        </div>
      )}
      {charsValid.includes(false) && (
        <div>
          <UiText message={/*i18n*/ "Only Hebrew letters can be traced:"} />{" "}
          <span lang="he" dir="rtl" className={styles.hebrew}>
            {[...text].map((character, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: characters in order
                key={i}
                className={charsValid[i] ? undefined : styles.invalid}
              >
                {character}
              </span>
            ))}
          </span>
        </div>
      )}

      <div className={styles.stage} aria-busy={placing}>
        {shown ? (
          <KameaSigil
            planet={shown.planet}
            text={shown.text}
            finals={shown.finals}
            sigil={shown}
            label={labelOf(shown, shown.planet as KameaImagePlanet)}
            className={`${styles.sigil} ${current ? "" : styles.stale}`}
          />
        ) : (
          // Before the first figure: the square alone, which is no work,
          // at full strength until a placement has actually begun.
          <KameaSigil
            planet={planet}
            text=""
            label={labelOf(null, planet)}
            className={`${styles.sigil} ${placing ? styles.stale : ""}`}
          />
        )}
      </div>
      {/* Seen, not announced: typing would announce it at every pause. */}
      <div className={styles.status} aria-hidden>
        {placing && drawn ? (
          <UiText message={/*i18n*/ "Placing the sigil…"} />
        ) : null}
      </div>
      {/* Announced: what was drawn, or that it could not be drawn well. */}
      <div role="status" className={styles.status}>
        {pending ? null : error ? (
          <UiText message={/*i18n*/ "This sigil could not be drawn."} />
        ) : current?.failed ? (
          <UiText
            message={
              /*i18n*/ "This sigil could not be drawn so that every mark stands clear of the others and of the square's lines; it is drawn as well as it can be, and may be hard to read."
            }
          />
        ) : current?.text ? (
          <span className={styles.visuallyHidden}>
            {labelOf(current, current.planet as KameaImagePlanet)}
          </span>
        ) : null}
      </div>

      <ReductionTable reduction={reduction} />

      {/* The one-row image the downloads draw, from the same figure. */}
      <div
        hidden
        ref={(element) => {
          ref.current = element?.querySelector("svg") ?? null;
        }}
      >
        {current && current.text && (
          <KameaSigilImage
            planet={current.planet}
            text={current.text}
            finals={current.finals}
            sigil={current}
            label={labelOf(current, current.planet as KameaImagePlanet)}
          />
        )}
      </div>
      <ExportControls
        target={ref}
        filename={
          link
            ? `KameaSigil-${planet}-${link.props.text.split(" ").join("-")}${finals ? "-finals" : ""}`
            : `KameaSigil-${planet}`
        }
        link={link}
        share={
          link
            ? () =>
                kameaSigilPagePath({ planet, text: link.props.text, finals })
            : undefined
        }
      />
    </Container>
  );
}
