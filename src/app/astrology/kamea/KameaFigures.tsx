"use client";
import { PlanetarySeal } from "magick-components/astrology/PlanetarySeal";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiText from "@/i18n/UiText";
import type { KameaFile } from "@/seo/kameas";
import styles from "./kamea.module.css";
import {
  KAMEA_SQUARE_LABELS,
  type KameaConstants,
  type KameaPlanetId,
  kameaAltMessage,
} from "./kameaPlanets";

/** Each seal's accessible name. */
const SEAL_LABELS: Record<KameaPlanetId, string> = {
  saturn: /*i18n*/ "Seal of Saturn",
  jupiter: /*i18n*/ "Seal of Jupiter",
  mars: /*i18n*/ "Seal of Mars",
  sol: /*i18n*/ "Seal of the Sun",
  venus: /*i18n*/ "Seal of Venus",
  mercury: /*i18n*/ "Seal of Mercury",
  luna: /*i18n*/ "Seal of the Moon",
};

/**
 * A planet's square, large: the static PNG under the page (plan 093, K4),
 * which the structured data names, with its files to download. A client
 * component only so that the alt text, an attribute, is translated where
 * the page is; the server renders all of it. Black on white, so on a light
 * card in the dark scheme (plan 076).
 */
export function KameaSquare({
  planet,
  constants,
  png,
  svg,
}: {
  planet: KameaPlanetId;
  /** The square's four numbers, which the alt text gives. */
  constants: KameaConstants;
  png: KameaFile & { width: number; height: number };
  svg: KameaFile;
}) {
  const { t } = useUiLanguage();
  return (
    <>
      {/* A plain image: the file is static and sized already, as the
          angels' sigils and the halls' drawings are. */}
      {/* biome-ignore lint/performance/noImgElement: see above */}
      <img
        src={png.path}
        width={png.width}
        height={png.height}
        alt={t(kameaAltMessage(planet), {
          square: t(KAMEA_SQUARE_LABELS[planet]),
          ...constants,
        })}
        className={`${styles.square} ${plateClass}`}
      />
      <p className={styles.downloads}>
        {/* Files, not pages: nothing to prefetch. */}
        <Link href={png.path} download={png.name} prefetch={false}>
          <UiText message={/*i18n*/ "Download PNG"} />
        </Link>
        <Link href={svg.path} download={svg.name} prefetch={false}>
          <UiText message={/*i18n*/ "Download SVG"} />
        </Link>
      </p>
    </>
  );
}

/**
 * A planet's seal after Agrippa's woodcut (plan 093, decision 11), in the
 * text's own colour, named for a screen reader in the page's language.
 */
export function KameaSeal({ planet }: { planet: KameaPlanetId }) {
  const { t } = useUiLanguage();
  return (
    <PlanetarySeal
      planet={planet}
      label={t(SEAL_LABELS[planet])}
      className={styles.seal}
    />
  );
}

/** A neighbouring square: its page and its name's message. */
interface KameaNeighbour {
  href: string;
  label: string;
}

/**
 * The squares before and after this one in the Chaldean order, as the
 * entity pages close (`PrevNext`), with its labels translated.
 */
export function KameaPrevNext({
  prev,
  next,
}: {
  prev?: KameaNeighbour;
  next?: KameaNeighbour;
}) {
  const { t } = useUiLanguage();
  return (
    <nav
      className={styles.prevNext}
      aria-label={t(/*i18n*/ "The seven kameas")}
    >
      {prev ? <Link href={prev.href}>← {t(prev.label)}</Link> : <span />}
      {next ? <Link href={next.href}>{t(next.label)} →</Link> : <span />}
    </nav>
  );
}
