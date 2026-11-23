"use client";
import type { Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import {
  angelSigilAltMessage,
  angelSigilFiles,
  angelSigilGeneratorHref,
  angelSigilText,
} from "@/seo/angelSigilFiles";
import styles from "./angels.module.css";

/**
 * An angel's Rose Cross sigil in its entry on the list (Gadi, 21 November
 * 2026): the static PNG the angel's own page shows (plan 088, S4), and a
 * link to watch it drawn. The entry's contents mount only when it is
 * opened, so the image is asked for then and never with the page; `lazy`
 * holds it further while it is below the window.
 */
export default function ListSigil({ angel }: { angel: Angel }) {
  const { t } = useUiLanguage();
  const { png } = angelSigilFiles(angel);
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
        alt={t(angelSigilAltMessage(angel), {
          name,
          number: angel.no,
          hebrew: angelSigilText(angel),
        })}
        loading="lazy"
        decoding="async"
        className={plateClass}
      />
      <figcaption>
        <UiRichText
          message={
            /*i18n*/ "{name}'s Rose Cross sigil. <0>Watch it drawn</0> in the sigil generator."
          }
          values={{ name }}
          components={{ 0: <Link href={angelSigilGeneratorHref(angel)} /> }}
        />
      </figcaption>
    </figure>
  );
}
