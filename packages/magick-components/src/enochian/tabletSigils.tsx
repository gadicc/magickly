import type { TabletVersionId } from "magick-data/enochian/tablets";

/*
 * The Watchtowers' sigils as `Tablet` draws them, and the versions'
 * names. Internal to the package: `Tablet` is the entry; the tests read
 * these to check the drawings.
 */

function EarthSigil() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <circle
        cx={0}
        cy={0}
        r={92}
        fill="none"
        stroke="black"
        strokeWidth={15}
      />
      {/* <circle cx={0} cy={0} r={1} fill="black" /> */}
      <path
        d={
          "M -10 -10 v -45 " +
          "c 0 -10, -10 -10, -20 -10" +
          "v -8 h 60 v 8" +
          "c -10 0, -20 0, -20 10" +
          "v 45 h -20"
        }
        fill="#c3b030"
        stroke="black"
      />
      <path
        d={
          "M -10 -10 v -45 " +
          "c 0 -10, -10 -10, -20 -10" +
          "v -8 h 60 v 8" +
          "c -10 0, -20 0, -20 10" +
          "v 45 h -20"
        }
        fill="#626e30"
        stroke="black"
        transform="rotate(90)"
      />
      <path
        d={
          "M -10 -10 v -45 " +
          "c 0 -10, -10 -10, -20 -10" +
          "v -8 h 60 v 8" +
          "c -10 0, -20 0, -20 10" +
          "v 45 h -20"
        }
        fill="black"
        stroke="black"
        transform="rotate(180)"
      />
      <path
        d={
          "M -10 -10 v -45 " +
          "c 0 -10, -10 -10, -20 -10" +
          "v -8 h 60 v 8" +
          "c -10 0, -20 0, -20 10" +
          "v 45 h -20"
        }
        fill="#993621"
        stroke="black"
        transform="rotate(270)"
      />
    </svg>
  );
}

/**
 * The Air sigil's Tau, on a grid of 100: a flat-topped crossbar whose
 * underside arches up to the stem and whose ends taper down and out, a thin
 * stem, and a foot flaring to a triangle. Drawn by hand after the Equinox's
 * Plate X (see `EquinoxSigils`), symmetric about x = 51.
 */
const AIR_TAU =
  "M25 21.5H77L84 33.5C74 27 62.5 24.5 52.2 24.5V76" +
  "C53 79.5 56 83 58.5 85.5H43.5C46 83 49 79.5 49.8 76" +
  "V24.5C39.5 24.5 28 27 18 33.5Z";

/**
 * One of the four Yods over the Tau, drawn as a small flame, as it
 * stands on the page (no rotation), about its centre: the point at the top
 * flicks over to the right and drops into a shallow hollow, the right side
 * swells out and runs down nearly straight to a second point at the
 * bottom, as sharp as the top's, and the left side runs down from the top
 * in a full, convex curve, widest a little above halfway, then turns into
 * a shallow hollow above the bottom point, so the outline has a gentle S
 * along its length. About 1.8 times as long as it is wide. Cubic segments
 * placed by eye against an enlarged crop of the Equinox's Plate X (see
 * `EquinoxSigils`) and checked against the width of its marks at a few
 * heights, not traced, and not any font's yod. Regardie's own drawing
 * (The Golden Dawn, vol. 4, 1940) gives the flames wavy strokes instead;
 * both versions here keep the plate's form.
 */
const AIR_YOD =
  "M-1.3 -5.5C-0.8 -4.6 -0.8 -3.2 0.3 -2.4C1.6 -1.5 3.4 -0.8 3.6 1.4" +
  "C3.8 2.8 3.6 4.4 2.8 5.5" +
  "C1.9 4.9 0.6 4 -0.6 3.5C-1.9 2.9 -3.6 1.6 -3.7 -0.3" +
  "C-3.75 -2.3 -2.9 -4.2 -1.3 -5.5Z";

/**
 * The Yods' centres along the grid's x, a little over the crossbar, about
 * 0.185 of its width apart. Each Yod is about 0.17 of the crossbar's width
 * long and leans about 34 degrees from vertical, top to the left (the
 * plate's lean about 35), centred over the stem.
 */
const AIR_YOD_XS = [33.2, 45.4, 57.6, 69.8];

/**
 * Air: a Tau with four Yods above it, drawn as small flames, yellow on
 * mauve within a yellow ring; `plain`, in black alone, as the Equinox's
 * Plate X prints it. The Golden Dawn calls the marks Yods (Regardie, The
 * Golden Dawn, vol. 4, 1940, p. 307), and Regardie says the sigils are
 * taken from Dee's Sigillum Dei Aemeth (p. 308). The T at the top of the
 * Sigillum's outer ring has a 4 written over it (Sloane MS 3188; The
 * Equinox I(7), 1912, Plate II, archive.org `crowley-equinox_202110`,
 * "The Equinox Vol. 1, No. 7", leaf n238), so the four Yods likely stand
 * for that 4: that is our inference, which no source states. Book T calls
 * flames Yods (the Ace of Wands, The Equinox I(8), 1912, p. 153, "The
 * Equinox Vol. 1, No. 8", leaf n183), hence Yods drawn as flames. Our own
 * drawing after Plate X, constructed in code.
 */
function AirSigil({ plain = false }: { plain?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <g stroke="#000">
        {!plain && <circle r={98} fill="#ff0" strokeWidth={2.5} />}
        {!plain && <circle r={80} fill="#774060" strokeWidth={2} />}
        <g
          fill={plain ? "#000" : "#ff0"}
          strokeWidth={0.6}
          strokeLinejoin="round"
          transform="scale(1.6) translate(-51 -45.5)"
        >
          <path d={AIR_TAU} />
          {AIR_YOD_XS.map((x) => (
            <path key={x} d={AIR_YOD} transform={`translate(${x} 11)`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** One arm of the Water sigil's cross potent, pointing up from the centre. */
const POTENT_ARM =
  "M -4 -4 V -54 Q -4 -60 -16 -62 V -69 H 16 V -62 Q 4 -60 4 -54 V -4 Z";

/** The figures in the cross's angles, as strokes around (0, 0). */
const ANGLE_FIGURES = {
  b: "M -7 -17 V 13 M -7 4 a 9 9 0 1 1 0 0.1",
  "6": "M 8 -16 Q -9 -14 -9 5 M -9 5 a 9 9 0 1 0 0 -0.1",
  "4": "M 4 15 V -16 L -11 6 H 10",
};

/**
 * Water: a cross potent with b, 6, 4 and b in its angles, in blue on
 * orange within a blue ring: Regardie, The Golden Dawn, vol. 4 (1940),
 * p.307. Drawn here from that description. `plain`: in black alone, the
 * figures 4 and b over b and 6, as the Equinox's Plate X prints it.
 */
function WaterSigil({ plain = false }: { plain?: boolean }) {
  const blue = plain ? "#000" : "#2255cc";
  const figures = plain
    ? ([
        ["4", -33, -33],
        ["b", 33, -33],
        ["b", -33, 33],
        ["6", 33, 33],
      ] as const)
    : ([
        ["b", -33, -33],
        ["6", 33, -33],
        ["4", -33, 33],
        ["b", 33, 33],
      ] as const);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      {!plain && <circle r={92} fill="#f80" stroke={blue} strokeWidth={15} />}
      <CrossPotent fill={blue} />
      <g
        fill="none"
        stroke={blue}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {figures.map(([figure, x, y]) => (
          <path
            key={`${x},${y}`}
            d={ANGLE_FIGURES[figure]}
            transform={`translate(${x} ${y})`}
          />
        ))}
      </g>
    </svg>
  );
}

/** A cross potent: four arms, each flared at its end. */
function CrossPotent({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {[0, 90, 180, 270].map((angle) => (
        <path key={angle} d={POTENT_ARM} transform={`rotate(${angle})`} />
      ))}
    </g>
  );
}

/** Earth as the Equinox's Plate X prints it: a cross potent, in black. */
function PlainEarthSigil() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <CrossPotent fill="#000" />
    </svg>
  );
}

/** One of the Fire sigil's twelve rays, a flame rising from the centre. */
const FLAME = "M 0 -36 c -8 -6 8 -12 0 -18 s 8 -12 0 -17";

/** The twelve rays' angles, every 30°. */
const FLAME_ANGLES = Array.from({ length: 12 }, (_, ray) => ray * 30);

/**
 * Fire: a circle with twelve rays, alternately mauve and yellow, about a
 * red centre and ring, on green within a red ring: Regardie, The Golden
 * Dawn, vol. 4 (1940), p.307. Drawn here from that description.
 */
function FireSigil() {
  const red = "#e22";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <circle r={92} fill="#2b2" stroke={red} strokeWidth={15} />
      <circle r={22} fill="none" stroke={red} strokeWidth={6} />
      <circle r={9} fill={red} />
      <g fill="none" strokeWidth={6} strokeLinecap="round">
        {FLAME_ANGLES.map((angle) => (
          <path
            key={angle}
            d={FLAME}
            stroke={angle % 60 ? "#ff0" : "#a05090"}
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Fire as the Equinox's Plate X prints it, in black: a small circle with
 * twelve rays, straight and wavy by turns.
 */
function PlainFireSigil() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
      <circle r={22} fill="none" stroke="#000" strokeWidth={6} />
      <g fill="none" stroke="#000" strokeWidth={6} strokeLinecap="round">
        {FLAME_ANGLES.map((angle) => (
          <path
            key={angle}
            d={angle % 60 ? FLAME : "M 0 -30 V -76"}
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </svg>
  );
}

/** Regardie's sigils, which the Golden Dawn's version and his print draw. */
export const Sigils = {
  earth: EarthSigil,
  air: () => <AirSigil />,
  water: () => <WaterSigil />,
  fire: FireSigil,
};

/**
 * The Equinox's sigils, from its Plate X, in black: *The Equinox* I(7)
 * (1912), "Liber Chanokh", Plate X, one sigil in each corner (Air top
 * left, Water top right, Earth bottom left, Fire bottom right); archive.org
 * `crowley-equinox_202110`, the file "The Equinox Vol. 1, No. 7", leaf
 * n256. These plain forms are our own drawings after that plate,
 * constructed in code from lines, arcs and curves, with no font's outlines.
 * Air's is a Tau with four Yods above it, drawn as small flames; we take
 * the Yods to stand, likely, for the 4 over the T in Dee's Sigillum Dei
 * Aemeth (Plate II, leaf n238), an inference no source states (see
 * `AirSigil`).
 * Of Regardie's coloured sigils (`Sigils`), only Air's form follows the
 * plate: Water and Fire are drawn from Regardie's description of them (The
 * Golden Dawn, vol. 4, 1940, p. 307), and Earth is a cross in four colours.
 */
export const EquinoxSigils = {
  earth: PlainEarthSigil,
  air: () => <AirSigil plain />,
  water: () => <WaterSigil plain />,
  fire: PlainFireSigil,
};

/** Each version as a drawing names it. */
export const VERSION_NAMES: Readonly<Record<TabletVersionId, string>> = {
  gd: "the Golden Dawn's version",
  regardie: "Regardie's print",
  equinox: "the Equinox's version",
  dee: "Dee's table of 1584",
  raphael: "Raphael's table of 1587",
};
