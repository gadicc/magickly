"use client";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import styles from "./angel.module.css";

/** One of the sigil's files, as the page links it. */
interface SigilFile {
  name: string;
  path: string;
}

/**
 * An angel's Rose Cross sigil (plan 088, S4): the static PNG at its own
 * size, a link into the generator with the name in it, and the files to
 * download. A client component only so that the alt text, an attribute,
 * is translated where the page is; the server renders all of it.
 */
export default function AngelSigil({
  name,
  number,
  hebrew,
  alt,
  png,
  svg,
  generatorHref,
}: {
  /** The angel's name in English: "Vehuiah". */
  name: string;
  /** The angel's number, 1 to 72; the alt text names it where needed. */
  number: number;
  /** The text the sigil traces: "והויה". */
  hebrew: string;
  /** The alt text's message (`angelSigilAltMessage`), translated here. */
  alt: string;
  png: SigilFile & { width: number; height: number };
  svg: SigilFile;
  /** The generator with the name in it. */
  generatorHref: string;
}) {
  const { t } = useUiLanguage();
  return (
    <section aria-labelledby="sigil">
      <h2 id="sigil">
        <UiText message={/*i18n*/ "Rose Cross sigil"} />
      </h2>
      {/* A plain image: the file is static and sized already, as the
          temple halls' are (plan 062). Black line art, so on a light card
          in the dark scheme (plan 076). */}
      {/* biome-ignore lint/performance/noImgElement: see above */}
      <img
        src={png.path}
        width={png.width}
        height={png.height}
        alt={t(alt, { name, number, hebrew })}
        loading="lazy"
        className={`${styles.sigil} ${plateClass}`}
      />
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
    </section>
  );
}
