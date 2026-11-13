import Data from "magick-data";
import type { SephirahRow, TreeOfLifePathRow } from "magick-data/rows";
import React from "react";
import { svgCoordinate } from "../svgCoordinate.ts";
import { FIELD_PATH_LIST_SEPARATOR, readFieldPath } from "./fieldPath.ts";
import {
  LineOutline,
  ORDERED_PATHS as orderedPaths,
  point,
  SEPHIRAH_CENTRES,
  sephirahWedges,
  TREE_GEOMETRY,
} from "./treeOfLifeFigure.tsx";

const _sephirot: SephirahRow[] = Object.values(Data.sephirah);
const _paths: Readonly<Record<string, TreeOfLifePathRow>> = Data.treeOfLifePath;

/**
 * A scale the sephirot are coloured in, from magick-data's colours: the
 * Queen's (`queen`) or the King's (`king`), each drawn with its `…Web` value.
 */
export type TreeColorScale = keyof SephirahRow["color"] extends infer Key
  ? Key extends `${infer Scale}Web`
    ? Scale
    : never
  : never;

/**
 * Which tradition puts the Hebrew letters on the paths: the Golden Dawn's
 * Hermetic Tree (`hermetic`) or the older Hebrew one (`hebrew`), as
 * magick-data's paths give each.
 */
export type TreePathAttribution = keyof typeof orderedPaths &
  keyof TreeOfLifePathRow;

/**
 * What `pathTitle` reads of a path: each attribution's letter, and the
 * Hermetic Tree's path number and trump. A magick-data path row is one.
 */
export type TitledPath = {
  [A in TreePathAttribution]?: {
    hebrewLetter?: { letter?: { name: string; he: string } };
    pathNo?: number;
    tarotTitle?: string;
  };
};

/** A sphere as the Tree draws it, which `sephirahHref` is given. */
export interface TreeSephirah {
  /** Its centre. */
  x: number;
  y: number;
  /** Its row in magick-data. */
  data: SephirahRow;
  /** Its colour in the scale drawn; quarters are comma-separated. */
  color: string;
  /** Its label. */
  text: string;
  /** The label's colour, where black would not read on the sphere. */
  textColor: string | undefined;
}

/** A label's line height, as a multiple of its font size. */
const LINE_PITCH = 1.2;

/**
 * A font size as a number of user units. The Tree page passes its query's
 * text through, and a CSS size such as "12px" is a valid SVG `font-size`, so
 * it is read leniently; anything without a number in it spaces the lines as
 * the usual 10 would.
 */
function fontSizeNumber(size: unknown): number {
  const value = Number.parseFloat(String(size));
  return Number.isFinite(value) && value > 0 ? value : 10;
}

/**
 * A sphere's label as the lines it is drawn on. A list, which field paths
 * join with "; " (`stones.*.name.en`), takes a line per item, so "star ruby;
 * turquoise" breaks between the stones and not inside one; anything else
 * breaks at its first space, as the Tree always has. Blank words are
 * dropped, as they always were.
 */
export function labelLines(text: string): string[] {
  if (text.includes(FIELD_PATH_LIST_SEPARATOR))
    return text
      .split(FIELD_PATH_LIST_SEPARATOR)
      .map((item) => item.trim())
      .filter((item) => item !== "");
  const words = text.split(" ").filter((word) => word !== "");
  return words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
}

/** A link, or a plain group when `href` is empty (GradeTree's paths). */
function SvgLink({
  href,
  children,
  ...props
}: {
  href?: string | null;
  id?: string;
  children: React.ReactNode;
}) {
  if (!href) return <g {...props}>{children}</g>;
  return (
    // @ts-expect-error: JSX types <a> as the HTML element, without xlinkHref
    <a {...props} xlinkHref={href}>
      {children}
    </a>
  );
}

/**
 * A path's tooltip, which search engines also read: "Path 31: Shin (ש),
 * Judgement" in the Hermetic attribution, the letter alone in the others.
 */
export function pathTitle(
  path: TitledPath,
  letterAttr: TreePathAttribution,
): string {
  const attribution = path[letterAttr];
  const letter = attribution?.hebrewLetter?.letter;
  if (!letter) return "";
  const named = `${letter.name} (${letter.he})`;
  if (letterAttr !== "hermetic") return named;
  const { pathNo, tarotTitle } = attribution;
  return `Path ${pathNo}: ${named}${tarotTitle ? `, ${tarotTitle}` : ""}`;
}

/*
 * Note: originally I used a lot of CSS classes, which worked superbly in the
 * browser, but was very inconsistent when exporting into external programs.
 */

export interface TreeOfLifeProps {
  /** The SVG's width; the container's, `"100%"`, when not given. */
  width?: string | number;
  /** The SVG's height; from the width and the figure's shape when not given. */
  height?: string | number;
  /** Each sphere's label, Keter first and Da'at eleventh, in place of `field`'s. */
  labels?: readonly string[];
  /** The scale the spheres are coloured in. */
  colorScale?: TreeColorScale;
  /**
   * What each sphere is labelled with: a field path into its magick-data
   * row (`name.he`, `planet.name.en.en`, `stones.*.name.en`), or several
   * joined by commas, which are drawn space-separated.
   */
  field?: string;
  /** The field path(s) set on an arc above each sphere's label. */
  topText?: string;
  /** The field path(s) set on an arc below each sphere's label. */
  bottomText?: string;
  /** Whose letters the paths carry. */
  letterAttr?: TreePathAttribution;
  /** A sephirah's id: that sphere is drawn and the others faded. */
  active?: string;
  /** A path's link, or `null` for none; `/kabbalah/path/<id>` by default. */
  pathHref?: (path: TreeOfLifePathRow) => string | null;
  /** A sphere's link, or `null` for none; `/kabbalah/sephirah/<id>` by default. */
  sephirahHref?: (sephirah: TreeSephirah) => string | null;
  /** A path's id (`"1_2"`): it is drawn on top and highlighted, the rest faded. */
  activePath?: string;
  /** Seen from behind, the body's view; the stylesheet mirrors the figure. */
  flip?: boolean;
  /** Draws Da'at, which only the Queen scale colours. */
  showDaat?: boolean;
  /** The labels' font size; from `field` when not given. */
  fontSize?: string | number;
  /** The `<svg>`; in the browser its links are followed by `location.href`. */
  ref?: React.RefObject<SVGSVGElement | null>;
}

const defaultSephirahHref = (s: TreeSephirah) =>
  "/kabbalah/sephirah/" + s.data.id;
const defaultPathHref = (path: TreeOfLifePathRow) =>
  "/kabbalah/path/" + path.id;

function TreeOfLife({
  width,
  height,
  labels,
  colorScale,
  field,
  topText = "index",
  bottomText = "",
  letterAttr = "hermetic",
  active,
  pathHref,
  sephirahHref,
  activePath,
  flip,
  showDaat,
  fontSize,
  ref,
}: TreeOfLifeProps) {
  const color = `${colorScale || "queen"}Web` as const;
  width = width || "100%";
  field = field || "index";
  const fieldPaths = field;

  sephirahHref = sephirahHref || defaultSephirahHref;
  pathHref = pathHref || defaultPathHref;

  if (!labels)
    labels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
      fieldPaths
        .split(",")
        .map((field) => readFieldPath(_sephirot[i], field))
        .join(" "),
    );

  const topTextArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
    topText
      .split(",")
      .map((path) => readFieldPath(_sephirot[i], path))
      .join(" "),
  );
  const bottomTextArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
    bottomText
      .split(",")
      .map((path) => readFieldPath(_sephirot[i], path))
      .join(" "),
  );

  const fontSizeFromFieldName: Readonly<Record<string, number>> = {
    index: 32,
    "name.en": 10,
    "name.he": 20,
    "name.roman": 12,
    "godName.name.he": 20,
  };

  if (!fontSize) fontSize = fontSizeFromFieldName[field] || 10;

  const { constructRadius, sephirahRadius, canvasWidth, canvasHeight } =
    TREE_GEOMETRY;
  const showConstructionCircles = false;
  const pillar = TREE_GEOMETRY.pillars.map((x) => ({ x }));
  const rowStart = TREE_GEOMETRY.rowStart;

  const labelled: readonly string[] = labels;
  /**
   * The ith sphere: Keter first, Da'at eleventh. Da'at has no King colour,
   * so in that scale it is drawn unfilled.
   */
  const sphere = (i: number): TreeSephirah => ({
    x: SEPHIRAH_CENTRES[i].x,
    y: SEPHIRAH_CENTRES[i].y,
    data: _sephirot[i],
    color: _sephirot[i].color[color] ?? "none",
    text: labelled[i] ?? "",
    textColor: _sephirot[i].color[`${color}Text`],
  });
  const sephirot = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(sphere);

  if (showDaat) sephirot.push(sphere(10));

  //console.log(sephirot);

  let pathIds: string[] = orderedPaths[letterAttr];
  if (activePath) {
    // Bring activePath to top
    pathIds = pathIds.filter((x) => x !== activePath);
    pathIds.unshift(activePath);
  }

  // Map to path data with that id
  const pathsToDraw = pathIds.map((id) => _paths[id]).reverse();

  const outerSephirot = activePath ? activePath.split("_").map(Number) : [];

  function sephirahOpacity(sephirah: TreeSephirah) {
    if (!active && !activePath) return 1;

    if (active && active === sephirah.data.id) return 1;

    if (activePath) {
      if (outerSephirot.includes(sephirah.data.index)) return 1;
    }

    return 0.1;
  }

  function pathLetterPos(path: TreeOfLifePathRow) {
    // Adjust position on path to avoid being covered over by other paths
    // prettier-ignore
    const specialPositions: Record<
      TreePathAttribution,
      Readonly<Record<string, number>>
    > = {
      hebrew: {
        "2_5": 0.3,
        "3_4": 0.3, // Half way to 2_5,3_4 intersection
        "2_6": 0.333,
        "3_6": 0.333, // Level with y-cent of 1_6, 2_4, 3_5
        "6_9": 0.635, // Visible between 7_8 and Yesod
      },
      hermetic: {
        "2_6": 0.333,
        "3_6": 0.333, // In line with Center 1_6, 2_4, 3_5
        "6_9": 0.635, // Visible between 7_8 and Yesod
      },
    };
    return specialPositions[letterAttr][path.id] || 0.5;
  }

  // const innerRef = React.useRef<SVGSVGElement>(null);
  // React.useImperativeHandle(ref, () => innerRef.current);

  if ("useEffect" in React) {
    // biome-ignore lint/correctness/useHookAtTopLevel: doesn't exist on server
    React.useEffect(() => {
      ref?.current?.querySelectorAll("a").forEach((a) => {
        a.onclick = function (e) {
          if (typeof window === "object") {
            e.preventDefault();
            const href = a.getAttribute("xlink:href");
            // href && router.push(href);  // TODO, maybe accept a router passed in?
            if (href) location.href = href;
          }
        };
      });
    }, [ref]);
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      // viewBox="0 0 316 600"
      // viewBox={"0 0 " + canvasWidth + " " + canvasHeight}
      viewBox={
        -canvasWidth / 2 + " " + 0 + " " + canvasWidth + " " + canvasHeight
      }
      id="TreeOfLife"
      width={width}
      height={height}
      ref={ref}
    >
      <style type="text/css">
        {`
        @font-face {
          font-family: 'Noto Sans';
          src: local('Noto Sans'), url('https://magick.ly/fonts/NotoSans-Regular.ttf') format('truetype')
        }
        @font-face {
          font-family: 'Noto Sans Hebrew';
          src: local("Noto Sans Hebrew"), url('https://magick.ly/fonts/NotoSansHebrew-Regular.ttf') format('truetype')
        }
        svg#TreeOfLife {
          font-family: 'Noto Sans', 'Noto Sans Hebrew', Arial, sans-serif;
        }
        a:visited * {
          fill: inherit;
        }
      ` + (flip ? "svg#TreeOfLife { transform: rotateY(180deg) }" : "")}
      </style>
      {/* Paths */}
      <g
        id="paths"
        style={{
          stroke: "#000",
          strokeWidth: 3,
          fill: "#fff",
          paintOrder: "stroke fill markers",
        }}
      >
        {pathsToDraw.map((path) => {
          const parts = path.id.split("_");
          const start = sephirot[Number(parts[0]) - 1];
          const end = sephirot[Number(parts[1]) - 1];

          const styleActive = { fill: "#ffa" };
          const styleInactive = { opacity: 0.2 };
          const style = activePath
            ? activePath === path.id
              ? styleActive
              : styleInactive
            : null;

          return (
            <SvgLink key={path.id} id={"path" + path.id} href={pathHref(path)}>
              <LineOutline
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                offset={8.5}
                style={style ?? undefined}
              />
              {/*
                  Note: Originally it was quite nice to have each letter inside the path.
                  But for export purposes, much more helpful to have all letters in their
                  own group (to edit style as a group).  MOVED BELOW.

                <text className={"letter"+activePathClass} x={letterPos.x} y={letterPos.y}
                    textAnchor="middle" dominantBaseline="middle">
                  { path[letterAttr]?.hebrewLetter?.letter?.he }
                </text>
                */}
              <title>{pathTitle(path, letterAttr)}</title>
            </SvgLink>
          );
        })}
      </g>
      <g id="pathLetters" style={{ fontSize: "100%" }}>
        {pathsToDraw.map((path) => {
          const parts = path.id.split("_");
          const start = sephirot[Number(parts[0]) - 1];
          const end = sephirot[Number(parts[1]) - 1];

          const shift = pathLetterPos(path);
          const letterPos = {
            x: start.x + (end.x - start.x) * shift,
            y: start.y + (end.y - start.y) * shift,
          };

          const styleActive = {};
          const styleInactive = { opacity: 0.2 };
          const style = activePath
            ? activePath === path.id
              ? styleActive
              : styleInactive
            : null;

          return (
            <SvgLink
              key={path.id}
              id={"pathLetter" + path.id}
              href={pathHref(path)}
            >
              <text
                key={path.id}
                style={style || undefined}
                x={letterPos.x}
                y={letterPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {path[letterAttr]?.hebrewLetter?.letter?.he}
              </text>
            </SvgLink>
          );
        })}
      </g>
      <g id="sephirot">
        {sephirot.map((s, i) => (
          <SvgLink key={i} id={s.data.id} href={sephirahHref(s)}>
            <circle
              cx={s.x}
              cy={s.y}
              r={sephirahRadius}
              fill={s.color.match(",") ? undefined : s.color}
              style={{
                // Override a:visited * { inherit } from style.
                fill: s.color.match(",") ? undefined : s.color,
              }}
              // Only Da'at is drawn dashed, and only it has these.
              stroke={s.data.color.strokeColor || "#000"}
              strokeWidth="1.568"
              strokeDasharray={s.data.color.strokeDasharray}
              opacity={sephirahOpacity(s)}
            ></circle>
            {(function () {
              const colors = s.color.split(",");
              if (colors.length < 2) return null;
              return sephirahWedges(s.x, s.y, colors).map((wedge, i) => (
                <path
                  // biome-ignore lint/suspicious/noArrayIndexKey: quarters keep their order
                  key={i}
                  style={{
                    fill: wedge.fill,
                    stroke: "#000000",
                    strokeWidth: 1.568,
                  }}
                  opacity={sephirahOpacity(s)}
                  d={wedge.d}
                />
              ));
            })()}
            {field === "gdGrade.id" ? (
              <g>
                <circle
                  cx={s.x - 20}
                  cy={s.y}
                  r="12"
                  fill="none"
                  stroke={s.textColor || "black"}
                />
                <text
                  x={s.x - 20}
                  y={s.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={s.textColor || "black"}
                >
                  {s.text.split("=")[0]}
                </text>

                <text
                  x={s.x}
                  y={s.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={s.textColor || "black"}
                  fontSize="150%"
                >
                  =
                </text>

                <rect
                  x={s.x + 10}
                  y={s.y - 10}
                  width="20"
                  height="20"
                  fill="none"
                  stroke={s.textColor || "black"}
                />
                <text
                  x={s.x + 20}
                  y={s.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={s.textColor || "black"}
                >
                  {s.text.split("=")[1]}
                </text>
              </g>
            ) : (
              (function () {
                const texts = labelLines(s.text);
                const style = {
                  // We repeat in "style" to override a:visited * { color }
                  style: { fill: s.textColor || "black" },
                  fill: s.textColor || "black",
                  fillOpacity: sephirahOpacity(s),
                  textAnchor: "middle" as const,
                  dominantBaseline: "middle" as const,
                  stroke: "none",
                  fontSize: fontSize,
                  fontStyle: "normal" as const,
                  fontWeight: "normal" as const,
                  letterSpacing: 0,
                  wordSpacing: 0,
                };
                if (texts.length > 1) {
                  // Lines a little more than a font size apart, the block
                  // centred on the sphere: ±6 at the usual 10, where a fixed
                  // ±11 left a line's height of gap between two.
                  const pitch = LINE_PITCH * fontSizeNumber(fontSize);
                  return (
                    <g>
                      {texts.map((line, n) => (
                        <text
                          // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity, and two items of a list may be the same word
                          key={n}
                          x={s.x}
                          y={svgCoordinate(
                            s.y + (n - (texts.length - 1) / 2) * pitch,
                          )}
                          {...style}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                } else {
                  return (
                    <text key={i} x={s.x} y={s.y} {...style}>
                      {s.text}
                    </text>
                  );
                }
              })()
            )}
            {(function () {
              const diameter = 64;
              const radius = diameter / 2;

              // http://digerati-illuminatus.blogspot.com/2008/05/approximating-semicircle-with-cubic.html
              const xValueInset = diameter * 0.05;
              const yValueOffset = (radius * 4.0) / 3.0;

              return (
                <g>
                  <path
                    id={"topTextPath" + i}
                    d={
                      `M ${point(s.x - radius, s.y)} ` +
                      `c ${point(xValueInset, -yValueOffset)} ` +
                      `${point(diameter - xValueInset, -yValueOffset)} ${diameter},0`
                    }
                    style={{ fill: "none", stroke: "none" }}
                  />

                  <text
                    id={"topText_" + i}
                    style={{
                      fontStyle: "normal",
                      fontWeight: "normal",
                      fontSize: "10px",
                      letterSpacing: "-0.5px",
                      wordSpacing: "0px",
                      fill: s.textColor || "black",
                      fillOpacity: sephirahOpacity(s),
                      stroke: "none",
                      strokeWidth: "0.8px",
                      strokeLinecap: "butt",
                      strokeLinejoin: "miter",
                      strokeOpacity: 1,
                    }}
                  >
                    <textPath
                      xlinkHref={"#topTextPath" + i}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      startOffset="50%"
                    >
                      {topTextArr[i]}
                    </textPath>
                  </text>

                  <path
                    id={"bottomTextPath" + i}
                    d={
                      `M ${point(s.x - radius, s.y)} ` +
                      `c ${point(xValueInset, yValueOffset)} ` +
                      `${point(diameter - xValueInset, yValueOffset)} ${diameter},0`
                    }
                    style={{ fill: "none", stroke: "none" }}
                  />

                  <text
                    id={"bottomText_" + i}
                    style={{
                      fontStyle: "normal",
                      fontWeight: "normal",
                      fontSize: "10px",
                      letterSpacing: "-0.5px",
                      wordSpacing: "0px",
                      fill: s.textColor || "black",
                      fillOpacity: sephirahOpacity(s),
                      stroke: "none",
                      strokeWidth: "0.8px",
                      strokeLinecap: "butt",
                      strokeLinejoin: "miter",
                      strokeOpacity: 1,
                    }}
                  >
                    <textPath
                      xlinkHref={"#bottomTextPath" + i}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      startOffset="50%"
                    >
                      {bottomTextArr[i]}
                    </textPath>
                  </text>
                </g>
              );
            })()}
          </SvgLink>
        ))}
      </g>
      {showConstructionCircles && (
        <>
          <circle
            cx={pillar[1].x}
            cy={rowStart}
            r={constructRadius}
            stroke="#f00"
            fill="white"
            fillOpacity="0.5"
          />
          <circle
            cx={pillar[1].x}
            cy={rowStart + constructRadius}
            r={constructRadius}
            stroke="#f00"
            fill="white"
            fillOpacity="0.5"
          />
          <circle
            cx={pillar[1].x}
            cy={rowStart + 2 * constructRadius}
            r={constructRadius}
            stroke="#f00"
            fill="white"
            fillOpacity="0.5"
          />
          <circle
            cx={pillar[1].x}
            cy={rowStart + 3 * constructRadius}
            r={constructRadius}
            stroke="#f00"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}

export default TreeOfLife;
