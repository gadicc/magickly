"use client";
import React from "react";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import type { AngelSigilStyle } from "@/render/contracts/angelSigil";
import {
  ANGEL_SIGIL_STYLE_LABELS,
  type AngelSigilSection,
} from "@/seo/angelSigilFiles";
import Cite from "@/sources/Cite";
import styles from "./angel.module.css";
import { useSigilStyleUrl } from "./urlState";

/*
 * The scans the captions cite, through <Cite> (src/sources/works.ts), each
 * caption saying what is the source's and what is ours (plan 096,
 * "Captions", decision 6):
 * - Mathers, *The Key of Solomon the King* (1889), Plate IV (leaf n79,
 *   mirrored): Fig. 18 for the band, Fig. 21 for the talisman's name;
 * - Regardie, *The Golden Dawn*, vol. 4 (1940), p. 57 (n51), the rules,
 *   and p. 58 (n52), the sigils of Metatron and Elohim: in copyright where
 *   the site is read (plan 091), so linked, never mirrored;
 * - Lenain, *La Science cabalistique* (Amiens, 1823): p. 45, the verses
 *   round the genii's talismans, and the title page (Google's PP11);
 * - Kircher, *Oedipus Aegyptiacus*, vol. II (1653), p. 280 (n287), which
 *   gives the 70th genius Genesis 1:1 in Latin (decision 8).
 * Each message is a descriptor so that it carries a translator's comment.
 */

const CAPTIONS = {
  band: /*i18n*/ {
    id: "The sigil inside a ring with the name in Hebrew at the top, as the angels' names are written round a pentacle in Mathers's <0>Key of Solomon</0> (1889), <1>Plate IV, Fig. 18</1>. Ours: one name instead of four, the name in roman letters at the bottom, and the sigil inside.",
    comment:
      "Caption of an angel's sigil drawn inside a ring, on the angel's page. <0> is a book's title, set in italics; <1> links the plate of the book it cites",
  },
  bare: /*i18n*/ {
    id: "Drawn alone, with the name beneath, as the Golden Dawn's own sigils of Metatron and Elohim are printed (Regardie, vol. 4, <0>p. 58</0>). Giving the 72 this form is ours.",
    comment:
      "Caption of an angel's sigil drawn on its own, on the angel's page. <0> links the page of Regardie's The Golden Dawn it cites",
  },
  rose: /*i18n*/ {
    id: "Traced through the letters of the Golden Dawn's rose by the Order's rules (Regardie, <0>The Golden Dawn</0>, vol. 4, pp. <1>57</1>–<2>58</2>). The rose shows which letters the line passes through.",
    comment:
      "Caption of an angel's sigil drawn over the Golden Dawn's rose, on the angel's page. <0> is the book's title, in italics; <1> and <2> link the two pages it cites",
  },
  talisman: /*i18n*/ {
    id: "A talisman as Lenain describes the genii's, the genius's verse written round it (<0>La Science cabalistique</0>, <1>p. 45</1>), lettered like the talisman on his <2>title page</2>. The name inside follows Mathers's <3>Key of Solomon</3> (1889), <4>Plate IV, Fig. 21</4>. Ours: Lenain says the verses are in Hebrew, and we letter his Latin; he draws no genius's talisman; and the sigil inside is the Golden Dawn's.",
    comment:
      "Caption of an angel's talisman, its sigil inside a ring lettered with its verse, on the angel's page. <0> and <3> are book titles, in italics; <1>, <2> and <4> link the pages they cite. A genius is one of the 72 angels, as Lenain calls them",
  },
} as const;

const GENESIS = /*i18n*/ {
  id: "Lenain gives {name} no psalm but the first verse of Genesis, in French; the Latin here is the Vulgate's, which Kircher, his source, gives for the 70th genius (<0>Oedipus Aegyptiacus</0>, vol. II, <1>p. 280</1>).",
  comment:
    "Added to the talisman's caption for Jabamiah only, the 70th angel, whose verse is the Bible's first. {name} is the angel's name. <0> is the book's title, in italics; <1> links its page",
};

const SIGIL_STYLE = /*i18n*/ {
  id: "Sigil style",
  comment:
    "Visible label of the menu on an angel's page that chooses how its Rose Cross sigil is drawn",
};

const EVERY_STYLE = /*i18n*/ {
  id: "Every style:",
  comment:
    "Introduces the angel page's list of each sigil style's files, PNG and SVG, as plain links",
};

const cite = { plain: true, rel: "noreferrer" } as const;

/** A style's caption, each scan it rests on cited by its page. */
function Caption({
  style,
  name,
  genesis,
}: {
  style: AngelSigilStyle;
  name: string;
  genesis: boolean;
}) {
  switch (style) {
    case "band":
      return (
        <UiRichText
          message={CAPTIONS.band.id}
          components={{
            0: <i />,
            1: <Cite work="mathers1889" leaf={79} region="fig18" {...cite} />,
          }}
        />
      );
    case "bare":
      return (
        <UiRichText
          message={CAPTIONS.bare.id}
          components={{
            0: <Cite work="regardie1940" leaf={52} {...cite} />,
          }}
        />
      );
    case "rose":
      return (
        <UiRichText
          message={CAPTIONS.rose.id}
          components={{
            0: <i />,
            1: <Cite work="regardie1940" leaf={51} {...cite} />,
            2: <Cite work="regardie1940" leaf={52} {...cite} />,
          }}
        />
      );
    case "talisman":
      return (
        <>
          <UiRichText
            message={CAPTIONS.talisman.id}
            components={{
              0: <i lang="fr" />,
              1: <Cite work="lenain1823" page={45} {...cite} />,
              2: <Cite work="lenain1823" page={11} preliminary {...cite} />,
              3: <i />,
              4: <Cite work="mathers1889" leaf={79} region="fig21" {...cite} />,
            }}
          />
          {genesis ? (
            <>
              {" "}
              <UiRichText
                message={GENESIS.id}
                values={{ name }}
                components={{
                  0: <i lang="la" />,
                  1: (
                    <Cite work="kircher1653Complutense" leaf={287} {...cite} />
                  ),
                }}
              />
            </>
          ) : null}
        </>
      );
  }
}

/**
 * An angel's Rose Cross sigil (plan 088, S4) in the style a reader picks
 * (plan 096): a native select of the four, the chosen style's static PNG
 * with its caption, the sentence linking the generator, the shown style's
 * downloads, and every style's files as plain links, so that a reader
 * without JavaScript, and image search, reaches each one.
 *
 * The style is the URL's (`urlState.ts`). The server renders the band,
 * the default, and only the band; a shared `?style=` link shows its style
 * once hydrated. Every style is the same 1,024-pixel square shown at the
 * same size, so a swap moves nothing below it.
 */
export default function AngelSigil({
  section,
}: {
  section: AngelSigilSection;
}) {
  const { t } = useUiLanguage();
  const [style, setStyle] = useSigilStyleUrl();
  const id = React.useId();
  const { name, number, hebrew, psalm, genesis, generatorHref } = section;
  const shown =
    section.styles.find((entry) => entry.style === style) ?? section.styles[0];
  const { png, svg } = shown;
  return (
    <section aria-labelledby="sigil">
      <h2 id="sigil">
        <UiText message={/*i18n*/ "Rose Cross sigil"} />
      </h2>
      <div className={styles.styleChoice}>
        <label htmlFor={id}>
          <UiText message={SIGIL_STYLE.id} />
        </label>
        <select
          id={id}
          value={shown.style}
          onChange={(event) => setStyle(event.target.value as AngelSigilStyle)}
        >
          {section.styles.map((entry) => (
            <option key={entry.style} value={entry.style}>
              {t(ANGEL_SIGIL_STYLE_LABELS[entry.style])}
            </option>
          ))}
        </select>
      </div>
      <figure className={styles.figure}>
        {/* The file at full size on a tap: the talisman's verse is small
            at 18rem on a phone (plan 096, decision 9). */}
        <a href={png.path} className={styles.full}>
          {/* A plain image: the file is static and sized already, as the
              temple halls' are (plan 062). Black line art, so on a light
              card in the dark scheme (plan 076). Keyed by style, so that
              the last style's picture never shows under this one's
              caption while the new file loads. */}
          {/* biome-ignore lint/performance/noImgElement: see above */}
          <img
            key={shown.style}
            src={png.path}
            width={png.width}
            height={png.height}
            alt={t(shown.alt, { name, number, hebrew, psalm })}
            loading="lazy"
            className={`${styles.sigil} ${plateClass}`}
          />
        </a>
        <figcaption>
          <Caption style={shown.style} name={name} genesis={genesis} />
        </figcaption>
      </figure>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The sigil traces the letters of {name}'s Hebrew name through the Golden Dawn's Rose Cross, by the Order's rules. <0>Watch it drawn</0> in the sigil generator, or draw another name there."
          }
          values={{ name }}
          components={{ 0: <Link href={generatorHref} /> }}
        />
      </p>
      <p className={styles.downloads}>
        {/* Files, not pages: nothing to prefetch. */}
        <Link href={png.path} download={png.name} prefetch={false}>
          <UiText message={/*i18n*/ "Download PNG"} />
        </Link>
        <Link href={svg.path} download={svg.name} prefetch={false}>
          <UiText message={/*i18n*/ "Download SVG"} />
        </Link>
      </p>
      <div className={styles.every}>
        <p id={`${id}-every`}>
          <UiText message={EVERY_STYLE.id} />
        </p>
        <ul aria-labelledby={`${id}-every`}>
          {section.styles.map((entry) => (
            <li key={entry.style}>
              <UiText message={ANGEL_SIGIL_STYLE_LABELS[entry.style]} />
              {": "}
              <Link href={entry.png.path} prefetch={false}>
                PNG
              </Link>
              {" · "}
              <Link href={entry.svg.path} prefetch={false}>
                SVG
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
