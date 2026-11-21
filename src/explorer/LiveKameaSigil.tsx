"use client";
import KameaSigil, {
  type KameaSigilProps,
  kameaSigil,
} from "magick-components/astrology/KameaSigil";
import React from "react";
import { useKameaSigil } from "@/app/astrology/kamea/sigils/useKameaSigil";

/**
 * `KameaSigil` as the explorer draws it live: the first props' figure is
 * placed at once (the examples' names clear quickly, so the page's HTML
 * has it), and every edit after is placed off the main thread, after a
 * pause in typing, as the generator places it (`useKameaSigil`), so a
 * word placement cannot clear does not freeze the tab at each keystroke.
 * Until an edit's figure arrives the last one stays.
 */
export default function LiveKameaSigil(props: KameaSigilProps) {
  const { planet, text, finals = false, sigil: _given, ...rest } = props;
  const [first] = React.useState(() => kameaSigil(planet, text, { finals }));
  const { sigil } = useKameaSigil(planet, text, finals, first);
  const shown = sigil ?? first;
  return (
    <KameaSigil
      {...rest}
      planet={shown.planet}
      text={shown.text}
      finals={shown.finals}
      sigil={shown}
    />
  );
}
