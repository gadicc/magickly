"use client";

import {
  Box,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Tablet, {
  type TabletSquare,
  tabletViewBox,
} from "magick-components/enochian/Tablet";
import tabletNotes, {
  sourceText,
  sourceUrl,
  squareNote,
  type TabletSource,
  type TabletTopic,
  type TabletVersionNote,
  versionNote,
} from "magick-data/enochian/tabletNotes";
import {
  DEFAULT_TABLET_VERSION,
  TABLET_VERSIONS,
  type TabletVersionId,
} from "magick-data/enochian/tablets";
import React from "react";
import { plateClass } from "@/drawings/plate";
import { PLATE_X, PlateXCitation } from "@/drawings/sigilSources";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";
import { componentImageFilename } from "@/render/componentImageUrl";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";
import useEnochianFont, { EnochianFont } from "../useEnochianFont";
import {
  countDifferences,
  differingSquares,
  SOURCE_NAMES,
  squareReadings,
  versionLetter,
  viewOf,
} from "./squareReadings";
import styles from "./tablets.module.css";
import { type TabletId, tabletQuery, useTabletUrl } from "./urlState";

const TABLET_NAMES: Record<TabletId, string> = {
  earth: "Earth",
  air: "Air",
  water: "Water",
  fire: "Fire",
};

/** A version's title, from its note. */
const versionTitle = (version: TabletVersionId) =>
  versionNote(version)?.title ?? version;

/**
 * A download's name, for what is drawn: the image's own name, and what
 * the page adds to it or leaves out ("enochian-fire-tablet-dee-plain").
 */
export function downloadName(
  image: string,
  shown: { alt: boolean; reversed: boolean; showSquares: boolean },
): string {
  return [
    image,
    shown.alt ? "-second-letters" : "",
    shown.reversed ? "" : "-plain",
    shown.showSquares ? "-differences" : "",
  ].join("");
}

/** A title inside a sentence: "the Golden Dawn's", not "The Golden Dawn's". */
const midSentence = (title: string) => title.replace(/^The /, "the ");

/** "Row 5, square 12", counting from 1 as a reader does. */
const squareName = ({ row, column }: TabletSquare) =>
  `Row ${row + 1}, square ${column + 1}`;

/** One line for the live region: the square and each version's letter. */
const squareSummary = (id: string, square: TabletSquare) =>
  `${squareName(square)}: ${TABLET_VERSIONS.map((version) => {
    const view = viewOf(id, version);
    return `${versionTitle(version)} ${view ? versionLetter(view, square.row, square.column) : "none"}`;
  }).join("; ")}`;

/** "13 squares", "1 square". */
const squares = (count: number) =>
  `${count} ${count === 1 ? "square" : "squares"}`;

/** The works cited, each linked to its scan where there is one. */
function Sources({ sources }: { sources: readonly TabletSource[] }) {
  return (
    <Typography component="ul" variant="body2" sx={{ pl: 3, mt: 0.5 }}>
      {sources.map((source) => {
        const text = sourceText(source);
        const url = sourceUrl(source);
        return (
          <li key={text}>
            {url ? (
              <a href={url} rel="noreferrer">
                {text}
              </a>
            ) : (
              text
            )}
          </li>
        );
      })}
    </Typography>
  );
}

/** A titled paragraph of the notes, with its sources. */
function Topic({ topic }: { topic: TabletTopic }) {
  return (
    <Box
      component="section"
      aria-labelledby={`topic-${topic.id}`}
      sx={{ mb: 2 }}
    >
      <Typography variant="h6" component="h4" id={`topic-${topic.id}`}>
        {topic.title}
      </Typography>
      <Typography variant="body1">{topic.text}</Typography>
      <Sources sources={topic.sources} />
    </Box>
  );
}

/** What each version and source has in a square, and the note on it. */
function SquareDetail({
  id,
  square,
  heading,
}: {
  id: string;
  square: TabletSquare;
  heading: "h3" | "h4";
}) {
  const note = squareNote(id, square.row, square.column);
  const versions = TABLET_VERSIONS.flatMap((version) => {
    const view = viewOf(id, version);
    return view
      ? [
          [
            versionTitle(version),
            versionLetter(view, square.row, square.column),
          ] as const,
        ]
      : [];
  });
  const printed = squareReadings(id, square.row, square.column).map(
    ([source, text]) => [SOURCE_NAMES[source], text] as const,
  );
  const list = (rows: readonly (readonly [string, string])[]) => (
    <Typography component="dl" variant="body2" sx={{ m: 0 }}>
      {rows.map(([name, text]) => (
        <Box key={name} sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <dt>{name}:</dt>
          <dd style={{ margin: 0 }}>{text}</dd>
        </Box>
      ))}
    </Typography>
  );
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle1" component={heading}>
        {squareName(square)}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
        In each version
      </Typography>
      {list(versions)}
      <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
        In each source
      </Typography>
      {list(printed)}
      {note && (
        <>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {note.note}
          </Typography>
          <Sources sources={note.sources} />
        </>
      )}
    </Box>
  );
}

/**
 * How the chosen version of this tablet differs from another: the count
 * and the squares, read from the readings, and the notes' words.
 */
function Comparison({
  id,
  version,
  other,
  text,
}: {
  id: TabletId;
  version: TabletVersionId;
  other: TabletVersionId;
  text: string | undefined;
}) {
  const count = countDifferences(id, version, other);
  if (!count) return null;
  const kinds = [
    [count.letter, "in letter"],
    [count.uv, "in u for v"],
    [count.case, "in case alone"],
    [count.empty, "left empty in one"],
  ] as const;
  const summary =
    count.squares.length === 0
      ? `The ${TABLET_NAMES[id]} tablet is the same in both.`
      : `In the ${TABLET_NAMES[id]} tablet, ${squares(count.squares.length)} differ: ${kinds
          .filter(([n]) => n > 0)
          .map(([n, kind]) => `${n} ${kind}`)
          .join(", ")}.`;
  return (
    <Box
      component="section"
      aria-labelledby={`compare-${other}`}
      sx={{ mb: 2 }}
    >
      <Typography variant="h6" component="h4" id={`compare-${other}`}>
        From {midSentence(versionTitle(other))}
      </Typography>
      {text && <Typography variant="body1">{text}</Typography>}
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {summary}
      </Typography>
      {count.squares.length > 0 && (
        <Typography component="details" variant="body2" sx={{ mt: 0.5 }}>
          <summary>The squares</summary>
          <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
            {count.squares.map((square) => (
              <li key={`${square.row},${square.column}`}>
                {squareName(square)}: {square.from ?? "empty"} here,{" "}
                {square.to ?? "empty"} there
              </li>
            ))}
          </Box>
        </Typography>
      )}
    </Box>
  );
}

/**
 * The versions that draw Regardie's coloured sigils, whose Air sigil takes
 * its form from the Equinox's Plate X (`Sigils` in the package's `tabletSigils.tsx`).
 */
const REGARDIE_SIGILS: ReadonlySet<TabletVersionId> = new Set([
  "gd",
  "regardie",
]);

/** The chosen version: its note and how it differs from the others. */
function VersionSection({
  id,
  note,
}: {
  id: TabletId;
  note: TabletVersionNote;
}) {
  return (
    <Box component="section" aria-labelledby="tablet-version" sx={{ mt: 3 }}>
      <Typography variant="h5" component="h2" id="tablet-version">
        {note.title}
      </Typography>
      <Typography variant="body1">{note.text}</Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>
        {note.reversed}
      </Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>
        {note.sigils}
      </Typography>
      {id === "air" && REGARDIE_SIGILS.has(note.id) && (
        // The Equinox's own version cites Plate X among its sources.
        <Typography variant="body2" sx={{ mt: 1 }}>
          The Air sigil&apos;s form is drawn after{" "}
          <a href={PLATE_X.url} rel="noreferrer">
            <PlateXCitation />
          </a>
          .
        </Typography>
      )}
      <Sources sources={note.sources} />
      <Typography variant="h6" component="h3" sx={{ mt: 2 }}>
        How it differs from the others
      </Typography>
      {TABLET_VERSIONS.filter((other) => other !== note.id).map((other) => (
        <Comparison
          key={other}
          id={id}
          version={note.id}
          other={other}
          text={note.differs[other]}
        />
      ))}
    </Box>
  );
}

export default function Tablets() {
  const [{ tablet: id, version }, setChoice] = useTabletUrl();
  const [reversed, setReversed] = React.useState(true);
  const [alt, setAlt] = React.useState(false);
  const [showSquares, setShowSquares] = React.useState(false);
  const [selected, setSelected] = React.useState<TabletSquare>();
  // A chosen square belongs to its tablet: another tablet, from the
  // select or from the URL (Back, a link), clears it.
  const [selectedOn, setSelectedOn] = React.useState(id);
  if (selectedOn !== id) {
    setSelectedOn(id);
    setSelected(undefined);
  }
  const { EnochianFontToggle, enochianFont } = useEnochianFont();
  // Two columns from `md` (tablets.module.css). The prerendered page is
  // the narrow one; the squares and second letters it moves are only
  // shown after a reader turns them on.
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const ref = React.useRef<SVGSVGElement>(null);
  const link = {
    slug: "enochian-tablet" as const,
    props: {
      id,
      font: enochianFont ? ("enochian" as const) : ("latin" as const),
      version,
    },
  };
  // The image link draws the tablet as published: its reversed letters
  // mirrored, and no outlines or second letters.
  const linkNote = showSquares
    ? "No image link while differences are shown."
    : alt || !reversed
      ? "No image link with second letters shown or reversed letters plain."
      : undefined;
  const marked = React.useMemo(() => differingSquares(id), [id]);
  const detail = React.useRef<HTMLDivElement>(null);
  const [scrollToDetail, setScrollToDetail] = React.useState(false);
  const chosen = selected
    ? marked.find(
        (square) =>
          square.row === selected.row && square.column === selected.column,
      )
    : undefined;
  const tabletNote = tabletNotes.tablets[id];
  const note = versionNote(version);
  // The second letters the tablet draws in its corners, in words for
  // readers who cannot see them.
  const seconds = (viewOf(id, version)?.marks ?? []).filter(
    (mark) => mark.alt?.length,
  );
  const [, , viewWidth, viewHeight] = tabletViewBox(id);
  /**
   * A square chosen on the tablet: a second tap on it clears it, as its
   * button does, and its detail, which may be off a phone's screen below
   * the list or below the panel's fold beside the tablet, is scrolled
   * into view.
   */
  const pickOnTablet = (square: TabletSquare) => {
    const same = chosen?.row === square.row && chosen?.column === square.column;
    setSelected(same ? undefined : square);
    setScrollToDetail(!same);
  };
  React.useEffect(() => {
    if (!scrollToDetail) return;
    setScrollToDetail(false);
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    detail.current?.scrollIntoView?.({
      block: "nearest",
      behavior: still ? "instant" : "smooth",
    });
  }, [scrollToDetail]);

  // The square whose button had focus when the squares moved across the
  // breakpoint, for their new place to focus again; cleared after every
  // commit, so it never outlives the move.
  const refocus = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    refocus.current = null;
  });
  const squaresSection = showSquares && (
    <SquaresSection
      id={id}
      marked={marked}
      chosen={chosen}
      choose={setSelected}
      detail={detail}
      heading={wide ? "h2" : "h3"}
      refocus={refocus}
    />
  );
  const exportControls = (
    <ExportControls
      // One key in both places keeps it mounted across the breakpoint,
      // and with it any "Copied" feedback it is showing.
      key="export"
      target={ref}
      filename={downloadName(componentImageFilename(link), {
        alt,
        reversed,
        showSquares,
      })}
      // The downloads draw what is shown.
      link={linkNote ? undefined : link}
      linkNote={linkNote}
      share={() =>
        window.location.pathname + tabletQuery({ tablet: id, version })
      }
    />
  );

  return (
    <Container sx={{ p: 2 }}>
      <div
        className={styles.layout}
        style={
          {
            "--tablet-ratio": viewWidth / viewHeight,
          } as React.CSSProperties
        }
      >
        <div className={styles.controls}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              alignItems: "center",
            }}
          >
            <FormControl>
              <InputLabel id="tablet-select-label">Tablet</InputLabel>
              <Select
                labelId="tablet-select-label"
                id="tablet-select"
                value={id}
                label="Tablet"
                onChange={(e) =>
                  setChoice({ tablet: e.target.value as TabletId })
                }
              >
                {TABLET_IDS.map((tablet) => (
                  <MenuItem key={tablet} value={tablet}>
                    {TABLET_NAMES[tablet]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="version-select-label">Version</InputLabel>
              <Select
                labelId="version-select-label"
                id="version-select"
                value={version}
                label="Version"
                onChange={(e) =>
                  setChoice({ version: e.target.value as TabletVersionId })
                }
              >
                {TABLET_VERSIONS.map((each) => (
                  <MenuItem key={each} value={each}>
                    {versionTitle(each)}
                    {each === DEFAULT_TABLET_VERSION ? " (default)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <EnochianFontToggle />
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={reversed}
                  onChange={(event) => setReversed(event.target.checked)}
                />
              }
              label="Reversed letters"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={alt}
                  onChange={(event) => setAlt(event.target.checked)}
                />
              }
              label="Second letters"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showSquares}
                  onChange={(event) => setShowSquares(event.target.checked)}
                />
              }
              label="Show where the sources differ"
            />
          </Box>
        </div>

        <Box
          // The tablet, its sigil and the note in a sigil's place are drawn
          // on white paper: a light card behind them in dark.
          className={`${plateClass} ${styles.tablet}`}
          sx={{
            "& [data-square]": { cursor: "pointer" },
            "& > svg": { maxWidth: "100%", height: "auto" },
          }}
        >
          <Tablet
            tablet={id}
            version={version}
            mirrorReversed={reversed}
            showSecondLetters={alt}
            frame
            enochianStyle={enochianFont ? EnochianFont.style : undefined}
            ref={ref}
            highlights={
              showSquares
                ? { squares: marked, selected: chosen, onSelect: pickOnTablet }
                : undefined
            }
          />
        </Box>

        <div className={styles.panel}>
          {wide && squaresSection}
          {/* Beside the tablet the downloads come first; on a phone,
              under the tablet, the second letters it draws. */}
          {wide && exportControls}
          {alt && (
            <Typography component="details" variant="body2" sx={{ mt: 1 }}>
              <summary>Second letters in {squares(seconds.length)}</summary>
              <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
                {seconds.map((mark) => (
                  <li key={`${mark.row},${mark.column}`}>
                    {squareName(mark)}: {mark.alt?.join(", ")}
                  </li>
                ))}
              </Box>
            </Typography>
          )}
          {!wide && exportControls}
          <div style={{ textAlign: "center", fontSize: "90%" }}>
            Enochian Font:{" "}
            <a href="https://fonts2u.com/enochian-plain.font">enochian-plain</a>
          </div>
        </div>
      </div>

      <Box component="section" aria-labelledby="tablet-about" sx={{ mt: 3 }}>
        <Typography variant="h5" component="h2" id="tablet-about">
          The {TABLET_NAMES[id]} tablet
        </Typography>
        <Typography variant="body1">{tabletNote.text}</Typography>
        <Sources sources={tabletNote.sources} />
        {!wide && squaresSection}
      </Box>

      {note && <VersionSection id={id} note={note} />}

      <AboutTablets />
      <br />
      <OpenSource
        files={[
          "/src/app/enochian/tablets/tablets.tsx",
          "/packages/magick-components/src/enochian/Tablet.tsx",
          "/packages/magick-data/src/enochian/tablets.json5",
          "/packages/magick-data/src/enochian/tabletNotes.json5",
        ]}
      />
    </Container>
  );
}

/**
 * The squares where the sources differ: their list, the live region and
 * the chosen square's detail. In the panel beside the tablet on a wide
 * screen (`heading` h2), and in the tablet's note on a narrow one (h3).
 *
 * It and `AboutTablets` follow `Tablets` because site search reads the
 * page's literal text in source order (`src/search/README.md`): kept in
 * the order the page reads, the published catalogue does not change.
 */
function SquaresSection({
  id,
  marked,
  chosen,
  choose,
  detail,
  heading,
  refocus,
}: {
  id: TabletId;
  marked: readonly TabletSquare[];
  chosen: TabletSquare | undefined;
  choose: (square: TabletSquare | undefined) => void;
  detail: React.RefObject<HTMLDivElement | null>;
  heading: "h2" | "h3";
  /** The square to focus on mounting, as the old place left it. */
  refocus: React.RefObject<string | null>;
}) {
  const list = React.useRef<HTMLOListElement>(null);
  // Crossing the breakpoint unmounts the section in one place and mounts
  // it in the other. Its cleanup runs before its buttons leave the page,
  // so it can see which had focus; the new one focuses the same square.
  React.useLayoutEffect(() => {
    const buttons = list.current;
    const square = refocus.current;
    if (square)
      buttons
        ?.querySelector<HTMLElement>(`[data-square-key="${square}"]`)
        ?.focus();
    return () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && buttons?.contains(active))
        refocus.current = active.dataset.squareKey ?? null;
    };
  }, [refocus]);
  return (
    <Box
      component="section"
      aria-labelledby="tablet-squares"
      sx={{ mt: heading === "h2" ? 0 : 2 }}
    >
      <Typography
        variant={heading === "h2" ? "h5" : "h6"}
        component={heading}
        id="tablet-squares"
      >
        Squares where the sources differ
      </Typography>
      <Typography variant="body2">
        Outlined on the tablet: where the versions differ in more than case,
        hold second letters, a doubt or a reversed letter, or have a note.
        Choose one, here or on the tablet, to see what each version and source
        has in it.
      </Typography>
      <Box
        component="ol"
        ref={list}
        aria-labelledby="tablet-squares"
        sx={{
          listStyle: "none",
          p: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
        }}
      >
        {marked.map((square) => {
          const isChosen =
            chosen?.row === square.row && chosen?.column === square.column;
          return (
            <li key={`${square.row},${square.column}`}>
              <Button
                size="small"
                variant={isChosen ? "contained" : "outlined"}
                aria-pressed={isChosen}
                data-square-key={`${square.row},${square.column}`}
                onClick={() => choose(isChosen ? undefined : square)}
              >
                {squareName(square)}
              </Button>
            </li>
          );
        })}
      </Box>
      <Typography
        variant="body2"
        aria-live="polite"
        sx={{ fontWeight: "bold" }}
      >
        {chosen ? squareSummary(id, chosen) : ""}
      </Typography>
      <div ref={detail}>
        {chosen && (
          <SquareDetail
            id={id}
            square={chosen}
            heading={heading === "h2" ? "h3" : "h4"}
          />
        )}
      </div>
    </Box>
  );
}

/** About the tablets and their versions, whichever is chosen. */
function AboutTablets() {
  return (
    <Box component="section" aria-labelledby="tablets-versions" sx={{ mt: 3 }}>
      <Typography variant="h5" component="h2" id="tablets-versions">
        About these tablets
      </Typography>
      <Typography variant="body1">{tabletNotes.intro}</Typography>
      <Typography variant="h6" component="h3" sx={{ mt: 1 }}>
        How the versions differ
      </Typography>
      {tabletNotes.differences.map((topic) => (
        <Topic key={topic.id} topic={topic} />
      ))}
      <Typography variant="body2" sx={{ mt: 1 }}>
        {tabletNotes.tablets.union.text}
      </Typography>
    </Box>
  );
}
