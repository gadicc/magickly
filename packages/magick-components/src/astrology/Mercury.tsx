"use client";

import type { DateTime } from "luxon";
import { type ImgHTMLAttributes, useEffect, useState } from "react";
import type { Retrograde } from "./mercuryRetrograde.ts";

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

/*
function MercuryDrawing({ phase, width, height, }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="0 0 170 162"
      width={width}
      height={height}
      transform={`rotate(${inclination})`}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        className="back"
        d="m85,5 a20,20 0 1,1 0,150 a20,20 0 1,1 0,-150"
        style={{ fill: "white", filter: "url(#glow)" }}
      />
      <path
        className="back"
        d="m85,5 a20,20 0 1,1 0,150 a20,20 0 1,1 0,-150"
        style={{ fill: "black" }}
      />
      <path
        className="moon"
        d={`m85,5 a${mag},20 0 1,${sweep[0]} 0,150 a20,20 0 1,${sweep[1]} 0,-150`}
        style={{ fill: "#ebc815" }}
      />
    </svg>
  );
}
*/

/**
 * A CSS string of `text`, quoted, with its quotes, backslashes and line
 * breaks escaped, so a URL cannot end the `url()` early.
 */
function cssString(text: string): string {
  return `"${text.replace(/["\\\n\r\f]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `)}"`;
}

export interface MercuryWidgetProps {
  /** Space around the picture, as CSS `padding`. */
  padding?: string;
  /** The tile's background image, a URL, drawn to cover; none if omitted. */
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
 * planet. The page's HTML has a blank line where the dates go.
 */
function MercuryWidget({
  padding = "10px 0 2px 0",
  background,
  image,
}: MercuryWidgetProps) {
  // The page is prerendered, and the dates depend on today's date, the
  // viewer's zone and their date format, so they can't be in the HTML.
  // undefined until the calculation answers, then a retrograde or null.
  const [retrograde, setRetrograde] = useState<Retrograde | null>();

  useEffect(() => {
    let current = true;
    // The ephemeris is worth about 22kB gzipped, so it loads here rather
    // than with the page.
    const update = () =>
      import("./mercuryRetrograde.ts")
        .then(({ currentOrNextRetrograde }) => {
          if (current)
            setRetrograde(currentOrNextRetrograde(new Date()) ?? null);
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

  const d = (date: DateTime) =>
    date.toLocaleString({ month: "short", day: "2-digit" });
  let label = "\u00a0"; // keeps the label's line height
  if (retrograde) label = `Retro ${d(retrograde.start)} – ${d(retrograde.end)}`;
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
