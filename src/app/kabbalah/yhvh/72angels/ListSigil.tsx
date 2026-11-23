"use client";
import type { Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import {
  angelPath,
  angelSigilGeneratorHref,
  angelSigilStyleAltMessage,
  angelSigilStyleAltValues,
  angelSigilStyleFiles,
} from "@/seo/angelSigilFiles";
import styles from "./angels.module.css";

/**
 * An angel's Rose Cross sigil in its entry on the list (Gadi, 21 November
 * 2026): the band's static PNG, the style the angel's own page shows first
 * (plan 096, decision 12), with no menu: at the list's 14rem a talisman's
 * verse cannot be read. The caption names the style and sends a reader to
 * the angel's page for the other three, and to the generator to watch it
 * drawn. The entry's contents mount only when it is opened, so the image
 * is asked for then and never with the page; `lazy` holds it further
 * while it is below the window.
 */
export default function ListSigil({ angel }: { angel: Angel }) {
  const { t } = useUiLanguage();
  const { png } = angelSigilStyleFiles(angel, "band");
  const name = angel.name.en;
  return (
    <figure className={styles.sigil}>
      {/* A plain image: the file is static and sized already, as on the
          angel's page. Black line art, so on a light plate in the dark
          scheme (plan 076). */}
      {/* biome-ignore lint/performance/noImgElement: see above */}
      <img
        src={png.path}
        width={png.width}
        height={png.height}
        alt={t(
          angelSigilStyleAltMessage(angel, "band"),
          angelSigilStyleAltValues(angel),
        )}
        loading="lazy"
        decoding="async"
        className={plateClass}
      />
      <figcaption>
        <UiRichText
          message={
            /*i18n*/ "{name}'s Rose Cross sigil, in a ring with its name. <0>Its page</0> has it on the rose, alone, and as a talisman with its verse; <1>watch it drawn</1> in the sigil generator."
          }
          values={{ name }}
          components={{
            0: <Link href={angelPath(angel)} />,
            1: <Link href={angelSigilGeneratorHref(angel)} />,
          }}
        />
      </figcaption>
    </figure>
  );
}
