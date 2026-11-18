"use client";
import {
  letterPoint,
  type RoseVersionId,
  roseRings,
} from "magick-components/gd/roseSigilGeometry";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "magick-components/gd/roseSigilLayout";
import { SigilImage, sigilFigure } from "magick-components/sigil/SigilImage";
import type {
  PlacedWord,
  SigilLayout,
  SigilMark,
} from "magick-components/sigil/types";
import React from "react";
import UiText from "@/i18n/UiText";

/** The rose's own grey, which the page's dark scheme re-inks. */
const ROSE_GREY = "rgba(0,0,0,.4)";
/** Where each place stands before placement: the plan's anchors. */
const ANCHOR = "#aa0";
/** Where placement drew each vertex. */
const PLACED = "#06c";

/**
 * What each mark of the plan is called in the table. The messages are
 * full names, not bare words like "bar", so that a catalogue entry shared
 * with another page cannot give them another sense.
 */
const MARK_NAMES: Record<SigilMark, string> = {
  start: /*i18n*/ "start circle",
  crook: /*i18n*/ "crook",
  noose: /*i18n*/ "noose",
  end: /*i18n*/ "end bar",
};

/** The table's columns, named as fully as the marks. */
const HEADINGS = [
  /*i18n*/ "Sigil word",
  /*i18n*/ "Vertex",
  /*i18n*/ "Rose letter",
  /*i18n*/ "Visit to its place",
  /*i18n*/ "Crooks",
  /*i18n*/ "Marks",
  /*i18n*/ "Moved",
];

/** The rose's rings and letters, centred on the origin. */
function Rose({ version }: { version: RoseVersionId }) {
  return (
    <>
      <circle r={10} stroke={ROSE_GREY} strokeWidth={0.5} fill="none" />
      {roseRings(version).map((ring, i) => (
        <React.Fragment key={ring.join("")}>
          <circle
            r={10 * (i + 2)}
            stroke={ROSE_GREY}
            strokeWidth={0.5}
            fill="none"
          />
          {ring.map((letter) => {
            const { x, y } = letterPoint(letter, version);
            return (
              <text
                key={letter}
                x={x}
                y={y}
                fill={ROSE_GREY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
              >
                {letter}
              </text>
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * One word's placement, over its region: each place's slack disc (how far
 * a visit may move and still read as that place), the path through the
 * anchors as the plan has it, and each vertex where placement drew it,
 * numbered as in the table, with a line from its anchor when it moved.
 */
function Placement({
  word,
  layout,
}: {
  word: PlacedWord;
  layout: SigilLayout<string>;
}) {
  const places = [...new Set(word.map((v) => v.place))];
  const anchors = word.map((v) => layout.anchor(v.place));
  return (
    <>
      {places.map((place) => {
        const { x, y } = layout.anchor(place);
        return (
          <circle
            key={place}
            cx={x}
            cy={y}
            r={layout.slack(place)}
            stroke={PLACED}
            strokeWidth={0.2}
            strokeDasharray="0.6 0.4"
            fill={PLACED}
            fillOpacity={0.06}
          />
        );
      })}
      <path
        d={anchors.map((a, i) => `${i ? "L" : "M"} ${a.x},${a.y}`).join(" ")}
        stroke={ANCHOR}
        strokeWidth={0.4}
        fill="none"
      />
      {word.map((v, i) => {
        const a = anchors[i];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a vertex is its position in the word.
          <React.Fragment key={i}>
            <circle cx={a.x} cy={a.y} r={0.5} fill={ANCHOR} />
            {(v.point.x !== a.x || v.point.y !== a.y) && (
              <line
                x1={a.x}
                y1={a.y}
                x2={v.point.x}
                y2={v.point.y}
                stroke={PLACED}
                strokeWidth={0.2}
              />
            )}
            <circle cx={v.point.x} cy={v.point.y} r={0.7} fill={PLACED} />
            <text
              x={v.point.x + 1}
              y={v.point.y - 1}
              fill={PLACED}
              fontSize={3}
            >
              {i + 1}
            </text>
          </React.Fragment>
        );
      })}
    </>
  );
}

/** What the plan says of each vertex, word by word, and how far it moved. */
function PlanTable({
  placed,
  layout,
}: {
  placed: readonly PlacedWord[];
  layout: SigilLayout<string>;
}) {
  const cell = { padding: "0 0.5em", textAlign: "start" } as const;
  return (
    <table style={{ borderCollapse: "collapse", fontSize: "0.875rem" }}>
      <thead>
        <tr>
          {HEADINGS.map((heading) => (
            <th key={heading} style={cell}>
              <UiText message={heading} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {placed.flatMap((word, w) =>
          word.map((v, i) => {
            const a = layout.anchor(v.place);
            const moved = Math.hypot(v.point.x - a.x, v.point.y - a.y);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a vertex is its position in its word.
              <tr key={`${w}-${i}`}>
                <td style={cell}>{w + 1}</td>
                <td style={cell}>{i + 1}</td>
                <td style={cell} lang="he">
                  {v.place}
                </td>
                <td style={cell}>{v.visit + 1}</td>
                <td style={cell}>{v.crooks}</td>
                <td style={cell}>
                  {v.marks.map((mark, k) => (
                    <React.Fragment key={mark}>
                      {k > 0 && ", "}
                      <UiText message={MARK_NAMES[mark]} />
                    </React.Fragment>
                  ))}
                </td>
                <td style={cell}>{moved.toFixed(2)}</td>
              </tr>
            );
          }),
        )}
      </tbody>
    </table>
  );
}

/**
 * The sigil page's Debug view of the engine (plan 088): the sigil as it
 * is drawn, over each place's slack disc, the path through the anchors
 * and the placed vertices; below it, what the plan says of each vertex
 * and how far placement moved it from its anchor, in the rose's units.
 * Not drawn on.
 */
export default function DebugSigil({
  text,
  showRose,
  version,
  ref,
}: {
  text: string;
  showRose: boolean;
  version: RoseVersionId;
  ref?: React.Ref<SVGSVGElement>;
}) {
  const layout = roseSigilLayout(version);
  const figure = React.useMemo(
    () => sigilFigure(text, layout, ROSE_SIGIL_PROFILE),
    [text, layout],
  );
  return (
    <>
      <SigilImage
        text={text}
        layout={layout}
        profile={ROSE_SIGIL_PROFILE}
        figure={figure}
        ref={ref}
        backdrop={(offset, index) => (
          <g key={index} transform={`translate(${offset.x} ${offset.y})`}>
            {showRose && <Rose version={version} />}
            {figure.placed[index] && (
              <Placement word={figure.placed[index]} layout={layout} />
            )}
          </g>
        )}
      />
      {figure.placed.length > 0 && (
        <PlanTable placed={figure.placed} layout={layout} />
      )}
    </>
  );
}
