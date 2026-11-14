"use client";

import { type ImgHTMLAttributes, useEffect, useState } from "react";
import { cssString } from "../cssString.ts";

const NARROW_CHARACTER =
  /[\p{sc=Latin}\p{sc=Cyrillic}\p{sc=Greek}\p{sc=Hebrew}\p{sc=Arabic}\p{sc=Common}\p{sc=Inherited}]/u;

/**
 * How many em a date label needs: 0.5 per character in the scripts above
 * (digits and punctuation included) and 1 per other character. In Chromium
 * no retrograde label in 79 locales was wider, though CJK and Indic labels
 * come out smaller than they could be. Emoji or full-width characters would
 * be wider, but the labels have none.
 */
function emWidth(text: string) {
  let em = 0;
  for (const char of text) em += NARROW_CHARACTER.test(char) ? 0.5 : 1;
  return em;
}

export interface MercuryWidgetProps {
  /** Space around the picture, as CSS `padding`. */
  padding?: string;
  /** The widget's background image, a URL, drawn to cover; none if omitted. */
  background?: string;
  /**
   * Mercury's picture, drawn 85 px square and decorative: a URL, or `<img>`
   * props for a responsive one (Next's `getImageProps()` gives them). None
   * if omitted.
   */
  image?: string | ImgHTMLAttributes<HTMLImageElement>;
}

/**
 * Mercury's next or current retrograde, worked out in the browser on today's
 * date and shown in the reader's own date format, under a picture of the
 * planet. Rendered on the server, it leaves a blank line where the dates
 * go.
 */
export function MercuryWidget({
  padding = "10px 0 2px 0",
  background,
  image,
}: MercuryWidgetProps) {
  // The page is prerendered, and the dates depend on today's date, the
  // viewer's zone and their date format, so they can't be in the HTML.
  // undefined until the calculation answers, then the retrograde's dates
  // as the viewer writes them, or null.
  const [retrograde, setRetrograde] = useState<{
    start: string;
    end: string;
  } | null>();

  useEffect(() => {
    let current = true;
    // The ephemeris is worth about 22kB gzipped, so it loads here rather
    // than with the page.
    const update = () =>
      Promise.all([import("./mercuryRetrograde.ts"), import("luxon")])
        .then(([{ currentOrNextRetrograde }, { DateTime }]) => {
          const d = (date: Date) =>
            DateTime.fromJSDate(date).toLocaleString({
              month: "short",
              day: "2-digit",
            });
          const found = currentOrNextRetrograde(new Date());
          if (current)
            setRetrograde(
              found ? { start: d(found.start), end: d(found.end) } : null,
            );
        })
        .catch((error) => {
          console.error(error);
          if (current) setRetrograde(null);
        });
    update();

    // A tab left open for days would otherwise keep a finished retrograde.
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  let label = "\u00a0"; // keeps the label's line height
  if (retrograde) label = `Retro ${retrograde.start} – ${retrograde.end}`;
  else if (retrograde === null) label = "Retro dates unknown";
  const fitCqi = Math.floor(1000 / emWidth(label)) / 10;

  return (
    <div
      style={{
        textAlign: "center",
        background: background ? `url(${cssString(background)})` : undefined,
        backgroundSize: "cover",
        height: "100%",
        containerType: "inline-size",
      }}
    >
      <div style={{ padding }}>
        {/* Decorative: the tile's title already names the planet. */}
        {image && (
          // biome-ignore lint/performance/noImgElement: the package cannot import next/image; an app passes its getImageProps() here
          <img
            height={85}
            width={85}
            alt=""
            {...(typeof image === "string" ? { src: image } : image)}
          />
        )}
      </div>
      {/* One line in any locale: 1rem, or smaller when the tile is narrow. */}
      <div
        style={{
          color: "#cc5",
          fontSize: `min(1rem, ${fitCqi}cqi)`,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default MercuryWidget;
