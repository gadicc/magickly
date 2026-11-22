"use client";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import {
  KAMEA_SQUARE_LABELS,
  type KameaPlanetId,
  PLANETARY_NAME_SIGIL_ALT,
} from "./kameaPlanets";
import styles from "./namePage.module.css";

/**
 * A traced sigil's accessible name, out of sight, for the figure that
 * names itself by its `id` (`aria-labelledby`): the server draws the
 * sigil, and only this text needs the reader's language, the square's
 * name in it included. The words are the static file's alt text.
 */
export function SigilLabel({
  id,
  name,
  hebrew,
  planet,
}: {
  id: string;
  /** The name, as the page gives it. */
  name: string;
  /** The letters traced. */
  hebrew: string;
  planet: KameaPlanetId;
}) {
  const { t } = useUiLanguage();
  return (
    <span id={id} className={styles.visuallyHidden}>
      {t(PLANETARY_NAME_SIGIL_ALT, {
        name,
        hebrew,
        square: t(KAMEA_SQUARE_LABELS[planet]),
      })}
    </span>
  );
}
