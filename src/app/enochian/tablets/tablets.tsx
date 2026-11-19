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
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Tablet, {
  type TabletHighlights,
  type TabletSquare,
  tabletViewBox,
} from "magick-components/enochian/Tablet";
import {
  TABLET_NAME_TRADITIONS,
  type TabletName,
  type TabletNameId,
  tabletNames,
} from "magick-data/enochian/tabletNames";
import tabletNotes, {
  squareNote,
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
import { useUiLanguage } from "@/i18n/LocaleProvider";
import OpenSource from "@/OpenSource";
import { componentImageFilename } from "@/render/componentImageUrl";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";
import useEnochianFont, { EnochianFont } from "../useEnochianFont";
import type { TabletNameLinks } from "./dictionaryLinks";
import NamesPanel, { namesThrough } from "./NamesPanel";
import { Sources, versionTitle } from "./Sources";
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

/** What the page draws over the tablet, for a download's name. */
export interface DrawnState {
  /** Second letters drawn in the squares' corners. */
  alt: boolean;
  /** Reversed letters drawn mirrored. */
  reversed: boolean;
  /** The Differences tab's outlines. */
  differences?: boolean;
  /** A chosen name, by its id. */
  name?: string;
  /** The regions tinted. */
  regions?: boolean;
  /** A chosen square, drawn outlined. */
  square?: TabletSquare;
}

/**
 * A download's name, for what is drawn: the image's own name, and what
 * the page adds to it or leaves out ("enochian-fire-tablet-dee-plain",
 * "enochian-earth-tablet-senior-row-left-regions").
 */
export function downloadName(image: string, shown: DrawnState): string {
  return [
    image,
    shown.alt ? "-second-letters" : "",
    shown.reversed ? "" : "-plain",
    shown.differences ? "-differences" : "",
    shown.name ? `-${shown.name}` : "",
    shown.regions ? "-regions" : "",
    shown.square
      ? `-row${shown.square.row + 1}-square${shown.square.column + 1}`
      : "",
  ].join("");
}

/**
 * A square of the grid in the page's units: 20 of the grid's 244 × 264
 * viewBox, fitted to the 210 × 297 page and scaled by 0.9 (`tabletSvg.tsx`).
 */
const SQUARE_UNITS = (20 * 210 * 0.9) / 244;

/**
 * Below this many pixels a square's reading-order number (about a sixth
 * of the square) would be too small to read: the wide layout's squares
 * (31 to 42 px) qualify, a phone's (24 to 29 px) do not, and there the
 * detail's words carry the order (plan 090, decision 5).
 */
export const NUMBERED_SQUARE_PX = 30;

/** How big the drawn squares are, in pixels; 0 until measured. */
function useSquarePixels(ref: React.RefObject<SVGSVGElement | null>) {
  const [pixels, setPixels] = React.useState(0);
  React.useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () =>
      setPixels((svg.getBoundingClientRect().width * SQUARE_UNITS) / 210);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [ref]);
  return pixels;
}

/**
 * The layout's width as `--layout-width`, for the phone's sticky grid
 * (tablets.module.css), which works out the sigil's height from it. Set
 * from here rather than read as container units: a size container would
 * hold the downloads' fixed "Copied" message inside the layout in some
 * browsers.
 */
function useLayoutWidth(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const layout = ref.current;
    if (!layout) return;
    const measure = () =>
      layout.style.setProperty(
        "--layout-width",
        `${layout.getBoundingClientRect().width}px`,
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    return () => observer.disconnect();
  }, [ref]);
}

/**
 * The reading order of a name's squares: 1 onwards, but Dee's and
 * Raphael's King reads one of its two centre squares seventh, so both
 * are 7.
 */
const readingOrder = (name: TabletName) =>
  name.squares.map((_, index) =>
    name.spellings && index >= 6 ? 7 : index + 1,
  );

/** The app bar's height, as SiteChrome publishes it. */
const appBarHeight = () =>
  Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-bar"),
  ) || 56;

/**
 * Brings a chosen name's squares on screen when they are not all showing:
 * centred in the room below the app bar where they fit, their top just
 * below the bar where they do not; at once under reduced motion. Nothing
 * moves while the tablet's box is stuck in place (beside the panel on a
 * wide screen, or the phone's grid above the list), where the grid shows
 * whole, so this moves only a page whose tablet scrolls with it, such as
 * a phone on its side, where the grid is twice the screen's height.
 *
 * While the app bar is hidden (`data-app-bar-hidden`, MyAppBar's
 * HideOnScroll) the screen's top is free; a scroll up brings the bar back,
 * so one that goes up allows for it.
 */
function showSquares(
  svg: SVGSVGElement | null,
  squares: readonly TabletSquare[],
) {
  const box = svg?.parentElement;
  if (!box || getComputedStyle(box).position === "sticky") return;
  const grid = svg.querySelector('svg[viewBox="0 0 244 264"]');
  const boxes = squares.flatMap(({ row, column }) => {
    // A square's ground, at its grid position (`tabletSvg.tsx`).
    const ground = grid?.querySelector(
      `rect[x="${column * 20 + 2}"][y="${row * 20 + 2}"]`,
    );
    return ground ? [ground.getBoundingClientRect()] : [];
  });
  if (!boxes.length) return;
  const top = Math.min(...boxes.map((each) => each.top));
  const bottom = Math.max(...boxes.map((each) => each.bottom));
  const height = bottom - top;
  if (!height) return;
  const margin = 8;
  const withBar = appBarHeight() + margin;
  const hidden = document.documentElement.hasAttribute("data-app-bar-hidden");
  const free = hidden ? margin : withBar;
  if (top >= free && bottom <= window.innerHeight) return;
  // Upward the bar comes back; downward it stays as it is.
  const goingUp = top < free;
  const bar = goingUp ? withBar : free;
  const room = window.innerHeight - bar;
  const target = height <= room ? bar + (room - height) / 2 : bar;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({
    top: top - target,
    behavior: still ? "instant" : "smooth",
  });
}

/** The panel's tabs. */
type PanelTab = "names" | "differences";

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

export default function Tablets({
  links,
}: {
  /** The names' dictionary headwords, built on the server (`nameLinks.ts`). */
  links?: TabletNameLinks;
} = {}) {
  const { t } = useUiLanguage();
  const [{ tablet: id, version }, setChoice] = useTabletUrl();
  const [reversed, setReversed] = React.useState(true);
  const [alt, setAlt] = React.useState(false);
  // Names by default, with nothing highlighted (plan 090, decision 2).
  const [tab, setTab] = React.useState<PanelTab>("names");
  const [selected, setSelected] = React.useState<TabletSquare>();
  // A chosen square belongs to its tablet: another tablet, from the
  // select or from the URL (Back, a link), clears it.
  const [selectedOn, setSelectedOn] = React.useState(id);
  if (selectedOn !== id) {
    setSelectedOn(id);
    setSelected(undefined);
  }
  // The Names tab: a chosen name and one previewed, by id, which is the
  // same on every tablet and in every version; the regions; and a square
  // chosen on the tablet that lies in several names.
  const [chosenId, setChosenId] = React.useState<TabletNameId>();
  const [previewId, setPreviewId] = React.useState<TabletNameId>();
  const [regions, setRegions] = React.useState(false);
  const [nameSquare, setNameSquare] = React.useState<TabletSquare>();
  const [revealed, setRevealed] = React.useState(0);
  // A name chosen in the list, whose squares are to be brought on screen.
  const [squaresWanted, setSquaresWanted] =
    React.useState<readonly TabletSquare[]>();
  const { EnochianFontToggle, enochianFont } = useEnochianFont();
  // Two columns from `md` (tablets.module.css). The prerendered page is
  // the narrow one.
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const ref = React.useRef<SVGSVGElement>(null);
  const squarePixels = useSquarePixels(ref);
  const layout = React.useRef<HTMLDivElement>(null);
  useLayoutWidth(layout);
  const link = {
    slug: "enochian-tablet" as const,
    props: {
      id,
      font: enochianFont ? ("enochian" as const) : ("latin" as const),
      version,
    },
  };
  const marked = React.useMemo(() => differingSquares(id), [id]);
  const view = viewOf(id, version);
  const names = view ? tabletNames(view) : [];
  const tradition = TABLET_NAME_TRADITIONS[version];
  const onNames = tab === "names";
  const chosenName = names.find((name) => name.id === chosenId);
  const previewed =
    previewId === chosenId
      ? undefined
      : names.find((name) => name.id === previewId);
  const detail = React.useRef<HTMLDivElement>(null);
  const [scrollToDetail, setScrollToDetail] = React.useState(false);
  const chosen = selected
    ? marked.find(
        (square) =>
          square.row === selected.row && square.column === selected.column,
      )
    : undefined;
  // The image link draws the tablet as published: its reversed letters
  // mirrored, and nothing drawn over it.
  const linkNote = !onNames
    ? "No image link while differences are shown."
    : chosenName || regions || nameSquare
      ? t(
          /*i18n*/ "No image link while a name, a square or the regions are shown.",
        )
      : alt || !reversed
        ? "No image link with second letters shown or reversed letters plain."
        : undefined;
  const tabletNote = tabletNotes.tablets[id];
  const note = versionNote(version);
  // The second letters the tablet draws in its corners, in words for
  // readers who cannot see them.
  const seconds = (view?.marks ?? []).filter((mark) => mark.alt?.length);
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

  /** A name chosen in the list, or let go: its squares brought on screen. */
  const chooseName = (name: TabletNameId | undefined) => {
    setNameSquare(undefined);
    setChosenId(name);
    const squares = names.find((each) => each.id === name)?.squares;
    // A new array each time, so choosing again looks again.
    if (squares) setSquaresWanted([...squares]);
  };
  React.useEffect(() => {
    if (squaresWanted) showSquares(ref.current, squaresWanted);
  }, [squaresWanted]);
  /**
   * A square chosen on the tablet in the Names tab: its name pinned, or
   * let go, where it lies in one; the names through it to choose from
   * where it lies in several; a second tap on that square clears it.
   */
  const pickName = (square: TabletSquare) => {
    if (nameSquare?.row === square.row && nameSquare.column === square.column) {
      setNameSquare(undefined);
      return;
    }
    const through = namesThrough(names, square);
    if (through.length === 1) {
      const [only] = through;
      setNameSquare(undefined);
      setChosenId(only.id === chosenId ? undefined : only.id);
    } else if (through.length > 1) setNameSquare(square);
    setRevealed((count) => count + 1);
  };

  const highlights: TabletHighlights | undefined = onNames
    ? {
        name: chosenName && {
          squares: chosenName.squares,
          numbers:
            squarePixels >= NUMBERED_SQUARE_PX
              ? readingOrder(chosenName)
              : undefined,
        },
        preview: previewed && { squares: previewed.squares },
        regions,
        squares: nameSquare ? [nameSquare] : [],
        selected: nameSquare,
        anySquare: true,
        onSelect: pickName,
      }
    : { squares: marked, selected: chosen, onSelect: pickOnTablet };

  const exportControls = (
    <ExportControls
      // One key in both places keeps it mounted across the breakpoint,
      // and with it any "Copied" feedback it is showing.
      key="export"
      target={ref}
      filename={downloadName(componentImageFilename(link), {
        alt,
        reversed,
        differences: !onNames,
        name: onNames ? chosenName?.id : undefined,
        regions: onNames && regions,
        square: onNames ? nameSquare : chosen,
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
        ref={layout}
        className={`${styles.layout} ${onNames ? styles.namesOpen : ""}`}
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
          </Box>
        </div>

        <Box
          // The tablet, its sigil and the note in a sigil's place are drawn
          // on white paper: a light card behind them in dark.
          className={`${plateClass} ${styles.tablet}`}
          sx={{
            "& [data-square]": { cursor: "pointer" },
            // Any square chooses its names in the Names tab.
            ...(onNames && {
              '& svg[viewBox="0 0 244 264"]': { cursor: "pointer" },
            }),
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
            highlights={highlights}
          />
        </Box>

        <div className={styles.panel}>
          <Tabs
            value={tab}
            onChange={(_event, value: PanelTab) => setTab(value)}
            aria-label={t(/*i18n*/ "What the panel shows")}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}
          >
            <Tab
              value="names"
              label={t(/*i18n*/ "Names")}
              id="tablet-tab-names"
              aria-controls="tablet-tabpanel"
            />
            <Tab
              value="differences"
              label={t(/*i18n*/ "Differences")}
              id="tablet-tab-differences"
              aria-controls="tablet-tabpanel"
            />
          </Tabs>
          <div
            role="tabpanel"
            id="tablet-tabpanel"
            aria-labelledby={`tablet-tab-${tab}`}
          >
            {onNames ? (
              <NamesPanel
                tablet={id}
                version={version}
                tradition={tradition}
                names={names}
                chosen={chosenName}
                choose={chooseName}
                preview={setPreviewId}
                regions={regions}
                setRegions={setRegions}
                square={nameSquare}
                clearSquare={() => setNameSquare(undefined)}
                links={links}
                revealed={revealed}
              />
            ) : (
              <SquaresSection
                id={id}
                marked={marked}
                chosen={chosen}
                choose={setSelected}
                detail={detail}
              />
            )}
          </div>
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
      </Box>

      {note && <VersionSection id={id} note={note} />}

      <AboutTablets />
      <br />
      <OpenSource
        files={[
          "/src/app/enochian/tablets/tablets.tsx",
          "/src/app/enochian/tablets/NamesPanel.tsx",
          "/packages/magick-components/src/enochian/Tablet.tsx",
          "/packages/magick-data/src/enochian/tablets.json5",
          "/packages/magick-data/src/enochian/TabletNames.ts",
          "/packages/magick-data/src/enochian/tabletNotes.json5",
        ]}
      />
    </Container>
  );
}

/**
 * The Differences tab: the squares where the sources differ, their list,
 * the live region and the chosen square's detail.
 *
 * It and `AboutTablets` follow `Tablets` because site search reads the
 * page's literal text in source order (`src/search/README.md`).
 */
function SquaresSection({
  id,
  marked,
  chosen,
  choose,
  detail,
}: {
  id: TabletId;
  marked: readonly TabletSquare[];
  chosen: TabletSquare | undefined;
  choose: (square: TabletSquare | undefined) => void;
  detail: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Box component="section" aria-labelledby="tablet-squares">
      <Typography variant="h5" component="h2" id="tablet-squares">
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
        {chosen && <SquareDetail id={id} square={chosen} heading="h3" />}
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
