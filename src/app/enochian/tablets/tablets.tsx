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
import { ReadingColumn } from "@/app/PageText";
import { plateClass } from "@/drawings/plate";
import { PLATE_X, PlateXCitation } from "@/drawings/sigilSources";
import ExportControls from "@/export/ExportControls";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import OpenSource from "@/OpenSource";
import { componentImageFilename } from "@/render/componentImageUrl";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";
import {
  isTabletPyramidImageVersion,
  tabletPyramidsSuffix,
} from "@/render/contracts/enochianTabletPyramids";
import useEnochianFont, { EnochianFont } from "../useEnochianFont";
import type { TabletNameLinks } from "./dictionaryLinks";
import NamesPanel, { namesToChoose } from "./NamesPanel";
import PyramidKey from "./PyramidKey";
import { Sources, versionTitle } from "./Sources";
import SquaresPanel from "./SquaresPanel";
import {
  countDifferences,
  differingSquares,
  SOURCE_NAMES,
  squareReadings,
  versionLetter,
  viewOf,
} from "./squareReadings";
import styles from "./tablets.module.css";
import {
  hasPyramids,
  type PanelTab,
  type TabletChoice,
  type TabletId,
  useTabletUrl,
} from "./urlState";

/**
 * The Watchtowers by name. The Tablet of Union's name is a message of
 * its own wherever it is shown (`t`), as the Watchtowers' copy waits for
 * the page's translation (plan 086, T9b).
 */
const TABLET_NAMES: Record<Exclude<TabletId, "union">, string> = {
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
 * A download's name, for what is drawn: the image's own name, which says
 * whether the squares are pyramids ("enochian-air-tablet-pyramids") and
 * with which symbols ("enochian-air-tablet-pyramids-symbols-upright"), and
 * what the page adds to it or leaves out ("enochian-fire-tablet-dee-plain",
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
 * A square of the grid as a share of the drawing's width: on a
 * Watchtower, 20 of the grid's 244 × 264 viewBox, fitted to the 210 × 297
 * page and scaled by 0.9; on the Tablet of Union, 20 of its 124-wide page
 * (`tabletSvg.tsx`).
 */
const squareShare = (id: TabletId) =>
  id === "union" ? 20 / 124 : (20 * 0.9) / 244;

/**
 * Below this many pixels a square's reading-order number (about a sixth
 * of the square) would be too small to read: the wide layout's squares
 * (31 to 42 px) qualify, a phone's (24 to 29 px) do not, and there the
 * detail's words carry the order (plan 090, decision 5).
 */
export const NUMBERED_SQUARE_PX = 30;

/** How big the drawn squares are, in pixels; 0 until measured. */
function useSquarePixels(
  ref: React.RefObject<SVGSVGElement | null>,
  share: number,
) {
  const [pixels, setPixels] = React.useState(0);
  React.useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () => setPixels(svg.getBoundingClientRect().width * share);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [ref, share]);
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
 * are 7, and an archangel's first letter is on the Tablet of Union, so
 * its Watchtower squares are 2 onwards.
 */
const readingOrder = (name: TabletName) =>
  name.squares.map((_, index) =>
    name.spellings && index >= 6 ? 7 : index + (name.unionLetter ? 2 : 1),
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
  union: boolean,
) {
  const box = svg?.parentElement;
  if (!box || getComputedStyle(box).position === "sticky") return;
  // A Watchtower's grid is an <svg> of its own, its squares from 2, 2; the
  // Tablet of Union draws in the root, its squares from 12, 12.
  const grid = union ? svg : svg.querySelector('svg[viewBox="0 0 244 264"]');
  const origin = union ? 12 : 2;
  const boxes = squares.flatMap(({ row, column }) => {
    // A square's ground, at its grid position (`tabletSvg.tsx`).
    const ground = grid?.querySelector(
      `rect[x="${column * 20 + origin}"][y="${row * 20 + origin}"][width="20"]`,
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
  const { t } = useUiLanguage();
  const count = countDifferences(id, version, other);
  if (!count) return null;
  const kinds = [
    [count.letter, "in letter"],
    [count.uv, "in u for v"],
    [count.case, "in case alone"],
    [count.empty, "left empty in one"],
  ] as const;
  const how = kinds
    .filter(([n]) => n > 0)
    .map(([n, kind]) => `${n} ${kind}`)
    .join(", ");
  const summary =
    id === "union"
      ? count.squares.length === 0
        ? t(/*i18n*/ "The Tablet of Union is the same in both.")
        : t(/*i18n*/ "In the Tablet of Union, {squares} differ: {kinds}.", {
            squares: squares(count.squares.length),
            kinds: how,
          })
      : count.squares.length === 0
        ? `The ${TABLET_NAMES[id]} tablet is the same in both.`
        : `In the ${TABLET_NAMES[id]} tablet, ${squares(count.squares.length)} differ: ${how}.`;
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
  const [
    {
      tablet: id,
      version,
      tab: tabInUrl,
      square: squareInUrl,
      pyramids: pyramidsInUrl = false,
      symbols: symbolsInUrl = false,
      upright: uprightInUrl = false,
    },
    setChoice,
    pushChoice,
  ] = useTabletUrl();
  const [reversed, setReversed] = React.useState(true);
  const [alt, setAlt] = React.useState(false);
  // The tablet drawn as pyramids (plan 095, decision 4): the URL's in a
  // version that has them, and remembered across Dee's and Raphael's,
  // whose URL drops it, so that it returns with the Golden Dawn's.
  const [pyramidsWanted, setPyramidsWanted] = React.useState(false);
  // Their sides' symbols, each on its side's outer edge unless stood
  // upright on the page: the URL's
  // while their switch shows, and remembered while it does not, as the
  // pyramids are.
  const [symbolsWanted, setSymbolsWanted] = React.useState(false);
  const [uprightWanted, setUprightWanted] = React.useState(false);
  // Names by default, with nothing highlighted (plan 090, decision 2).
  const [tab, setTabShown] = React.useState<PanelTab>("names");
  const [selected, setSelected] = React.useState<TabletSquare>();
  // A square chosen on the tablet in the Names tab that lies in several
  // names.
  const [nameSquare, setNameSquare] = React.useState<TabletSquare>();
  // The Squares tab's square, whose pyramid it shows (plan 095).
  const [pyramidSquare, setPyramidSquare] = React.useState<TabletSquare>();
  // A chosen square belongs to its tablet, in any tab: another tablet,
  // from the select or from the URL (Back, a link), clears it. The
  // Tablet of Union's squares are not a Watchtower's.
  const [selectedOn, setSelectedOn] = React.useState(id);
  if (selectedOn !== id) {
    setSelectedOn(id);
    setSelected(undefined);
    setNameSquare(undefined);
    setPyramidSquare(undefined);
  }
  // Dee's and Raphael's tables have no pyramids, so no square to show.
  if (pyramidSquare && !hasPyramids(version)) setPyramidSquare(undefined);
  // The tab and the square a URL names: a shared link once hydrated (the
  // prerendered page has neither), a URL changed under the page, or Back
  // to an entry that records the tab it was left from. A URL that names
  // neither leaves them as they are. Whether the tablet is drawn as
  // pyramids is the URL's wherever the version has them, and is kept
  // across a version without; so with their symbols, while the pyramids
  // are drawn, and their standing upright, while the symbols are. The
  // first key seen is the default URL's.
  const urlKey = `${tabInUrl ?? ""} ${squareInUrl ? `${squareInUrl.row},${squareInUrl.column}` : ""} ${version} ${pyramidsInUrl} ${symbolsInUrl} ${uprightInUrl}`;
  const [urlSeen, setUrlSeen] = React.useState(
    `  ${DEFAULT_TABLET_VERSION} false false false`,
  );
  if (urlSeen !== urlKey) {
    setUrlSeen(urlKey);
    if (tabInUrl) setTabShown(tabInUrl);
    if (squareInUrl) setPyramidSquare(squareInUrl);
    // Where the version has pyramids the URL says whether they are drawn,
    // and where they are, whether their symbols are and how they stand.
    if (hasPyramids(version)) {
      setPyramidsWanted(pyramidsInUrl);
      if (pyramidsInUrl) {
        setSymbolsWanted(symbolsInUrl);
        if (symbolsInUrl) setUprightWanted(uprightInUrl);
      }
    }
  }
  /**
   * A change of the URL's choices, keeping the tab shown and the Squares
   * tab's square in it; the square goes with its tablet.
   */
  const choose = (change: Partial<TabletChoice>) =>
    setChoice({
      tab,
      pyramids: pyramidsWanted,
      symbols: symbolsWanted,
      upright: uprightWanted,
      ...(change.tablet && change.tablet !== id
        ? {}
        : { square: pyramidSquare }),
      ...change,
    });
  /** Another tab: the URL holds the square only while Squares is open. */
  const setTab = (next: PanelTab) => {
    setTabShown(next);
    setChoice({ tab: next, square: pyramidSquare });
  };
  // A choice of square made by keyboard takes the focus to its detail,
  // whose heading then says it; one made on the tablet is said by the
  // live region instead, so that it is not heard twice.
  const [focusPyramid, setFocusPyramid] = React.useState(false);
  const [announcePyramid, setAnnouncePyramid] = React.useState(false);
  const pyramidFocused = React.useCallback(() => setFocusPyramid(false), []);
  // The large pyramid's symbols on their sides' outer edges, as
  // Regardie's drawings (vol. 4) have them, or upright: the page's for
  // the session, across squares and
  // tabs, and apart from the whole tablet's, which the URL keeps.
  const [squareUpright, setSquareUpright] = React.useState(false);
  // The Names tab: a chosen name and one previewed, by id, which is the
  // same on every tablet and in every version, and the regions.
  const [chosenId, setChosenId] = React.useState<TabletNameId>();
  const [previewId, setPreviewId] = React.useState<TabletNameId>();
  const [regions, setRegions] = React.useState(false);
  const [revealed, setRevealed] = React.useState(0);
  // A name chosen in the list, whose squares are to be brought on screen,
  // and whether they are the Tablet of Union's.
  const [squaresWanted, setSquaresWanted] = React.useState<{
    squares: readonly TabletSquare[];
    union: boolean;
  }>();
  const { EnochianFontToggle, enochianFont } = useEnochianFont();
  // Two columns from `md` (tablets.module.css). The prerendered page is
  // the narrow one.
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const ref = React.useRef<SVGSVGElement>(null);
  const union = id === "union";
  const view = viewOf(id, version);
  const pyramidsOffered = hasPyramids(version) && view !== undefined;
  const pyramids = pyramidsWanted && pyramidsOffered;
  const symbols = pyramids && symbolsWanted;
  const pyramidSymbols = symbols
    ? uprightWanted
      ? ("upright" as const)
      : ("outward" as const)
    : undefined;
  // Measured again when a drawing replaces the note of a version with no
  // Tablet of Union.
  const squarePixels = useSquarePixels(ref, view ? squareShare(id) : 0);
  const layout = React.useRef<HTMLDivElement>(null);
  useLayoutWidth(layout);
  const font = enochianFont ? ("enochian" as const) : ("latin" as const);
  const flatLink = {
    slug: "enochian-tablet" as const,
    props: { id, font, version },
  };
  // Pyramids have an image of their own (plan 095, decision 5), in the
  // versions that have them, which are the only ones they are drawn in.
  // A version drawn with pyramids that the image does not take (none
  // today: a test holds the image's versions to magick-data's) has its
  // link withheld below, never the flat image's in its place; its
  // downloads are named as the image would be.
  const pyramidsUnlinked = pyramids && !isTabletPyramidImageVersion(version);
  const link =
    pyramids && isTabletPyramidImageVersion(version)
      ? {
          slug: "enochian-tablet-pyramids" as const,
          props: {
            id,
            font,
            version,
            symbols: pyramidSymbols ?? ("none" as const),
          },
        }
      : flatLink;
  const imageName = pyramidsUnlinked
    ? `${componentImageFilename(flatLink)}${tabletPyramidsSuffix(pyramidSymbols ?? "none")}`
    : componentImageFilename(link);
  const marked = React.useMemo(() => differingSquares(id), [id]);
  const names = view ? tabletNames(view) : [];
  const tradition = TABLET_NAME_TRADITIONS[version];
  const onNames = tab === "names";
  const onSquares = tab === "squares";
  // The Squares tab draws and chooses squares only where there are
  // pyramids.
  const pyramidsShown = onSquares && hasPyramids(version);
  // The regions are a Watchtower's: the Union draws none, and so a
  // download or the image link does not count them there.
  const regionsShown = regions && !union;
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
  // The second letters the tablet draws in its corners, in words for
  // readers who cannot see them.
  const seconds = (view?.marks ?? []).filter((mark) => mark.alt?.length);
  // What the choices draw differently from the published image, from
  // what this view has: a choice that draws nothing here (second letters
  // or plain letters where the view has none, the Differences tab where
  // no square differs, as on the Tablet of Union) neither withholds the
  // image link nor renames a download.
  // No second letters on pyramids: no room on their sides.
  const altShown = alt && seconds.length > 0 && !pyramids;
  const plainShown =
    !reversed && (view?.marks ?? []).some((mark) => mark.reversed);
  const differencesShown = tab === "differences" && marked.length > 0;
  // The image link draws the tablet as published, flat or as pyramids:
  // its reversed letters mirrored, and nothing drawn over it.
  const linkNote = pyramidsUnlinked
    ? // Unreachable today (above), so not a catalog message.
      "No image link for this version's pyramids."
    : differencesShown
      ? t(/*i18n*/ "No image link while differences are shown.")
      : onNames && (chosenName || regionsShown || nameSquare)
        ? t(
            /*i18n*/ "No image link while a name, a square or the regions are shown.",
          )
        : pyramidsShown && pyramidSquare
          ? t(/*i18n*/ "No image link while a square is shown.")
          : altShown || plainShown
            ? t(
                /*i18n*/ "No image link with second letters shown or reversed letters plain.",
              )
            : undefined;
  const tabletNote = tabletNotes.tablets[id];
  const note = versionNote(version);
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
    // A new object each time, so choosing again looks again.
    if (squares) setSquaresWanted({ squares, union });
  };
  React.useEffect(() => {
    if (squaresWanted)
      showSquares(ref.current, squaresWanted.squares, squaresWanted.union);
  }, [squaresWanted]);

  /**
   * A square chosen for the Squares tab: on the tablet (a second tap on
   * it lets it go, and its detail is scrolled into view), with the picker
   * or from a name's squares (the focus taken to its detail, and the tab
   * opened).
   */
  const choosePyramid = (
    square: TabletSquare | undefined,
    focus = false,
    from?: PanelTab,
  ) => {
    setTabShown("squares");
    setPyramidSquare(square);
    // From a name's square, a history entry, so Back returns to the name.
    if (from) pushChoice({ tab: "squares", square }, from);
    else setChoice({ tab: "squares", square });
    setFocusPyramid(focus && Boolean(square));
    setAnnouncePyramid(!focus);
    setScrollToDetail(!focus && Boolean(square));
  };
  const pickPyramid = (square: TabletSquare) =>
    choosePyramid(
      pyramidSquare?.row === square.row &&
        pyramidSquare.column === square.column
        ? undefined
        : square,
    );
  /**
   * A square chosen on the tablet in the Names tab: its name pinned, or
   * let go, where it lies in one (or in one and the archangel built on
   * it); the names through it to choose from where it lies in several; a
   * second tap on that square clears it.
   */
  const pickName = (square: TabletSquare) => {
    if (nameSquare?.row === square.row && nameSquare.column === square.column) {
      setNameSquare(undefined);
      return;
    }
    // An archangel shares its base name's squares: the base is pinned,
    // and its detail offers the archangel.
    const through = namesToChoose(names, square);
    if (through.length === 1) {
      const [only] = through;
      setNameSquare(undefined);
      setChosenId(only.id === chosenId ? undefined : only.id);
    } else if (through.length > 1) setNameSquare(square);
    setRevealed((count) => count + 1);
  };

  const highlights: TabletHighlights | undefined = onSquares
    ? pyramidsShown
      ? {
          squares: pyramidSquare ? [pyramidSquare] : [],
          selected: pyramidSquare,
          anySquare: true,
          onSelect: pickPyramid,
        }
      : { squares: [] }
    : onNames
      ? {
          name: chosenName && {
            squares: chosenName.squares,
            numbers:
              squarePixels >= NUMBERED_SQUARE_PX
                ? readingOrder(chosenName)
                : undefined,
          },
          preview: previewed && { squares: previewed.squares },
          regions: regionsShown,
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
      filename={downloadName(imageName, {
        alt: altShown,
        reversed: !plainShown,
        differences: differencesShown,
        name: onNames ? chosenName?.id : undefined,
        regions: onNames && regionsShown,
        square: onNames
          ? nameSquare
          : onSquares
            ? pyramidsShown
              ? pyramidSquare
              : undefined
            : chosen,
      })}
      // The downloads draw what is shown.
      link={linkNote ? undefined : link}
      linkNote={linkNote}
    />
  );

  return (
    <Container sx={{ p: 2 }}>
      <div
        ref={layout}
        className={`${styles.layout} ${(onNames || pyramidsShown) && view ? styles.namesOpen : ""} ${union ? styles.union : ""}`}
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
                onChange={(e) => choose({ tablet: e.target.value as TabletId })}
              >
                {TABLET_IDS.map((tablet) => (
                  <MenuItem key={tablet} value={tablet}>
                    {tablet === "union"
                      ? t(/*i18n*/ "Tablet of Union")
                      : TABLET_NAMES[tablet]}
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
                  choose({ version: e.target.value as TabletVersionId })
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
              className={styles.touchable}
              control={
                <Switch
                  checked={reversed}
                  onChange={(event) => setReversed(event.target.checked)}
                />
              }
              label="Reversed letters"
            />
            <FormControlLabel
              className={styles.touchable}
              // None on pyramids, so the switch rests while they are drawn.
              disabled={pyramids}
              control={
                <Switch
                  checked={alt}
                  onChange={(event) => setAlt(event.target.checked)}
                />
              }
              label="Second letters"
            />
            {pyramidsOffered && (
              <FormControlLabel
                className={styles.touchable}
                control={
                  <Switch
                    checked={pyramids}
                    onChange={(event) => {
                      setPyramidsWanted(event.target.checked);
                      // The symbols return with the pyramids.
                      setChoice({
                        pyramids: event.target.checked,
                        symbols: symbolsWanted,
                        upright: uprightWanted,
                      });
                    }}
                  />
                }
                label={t(/*i18n*/ "Draw as pyramids")}
              />
            )}
            {pyramids && (
              <FormControlLabel
                className={styles.touchable}
                control={
                  <Switch
                    checked={symbols}
                    onChange={(event) => {
                      setSymbolsWanted(event.target.checked);
                      setChoice({
                        symbols: event.target.checked,
                        upright: uprightWanted,
                      });
                    }}
                  />
                }
                label={t(/*i18n*/ "Symbols on the sides")}
              />
            )}
            {symbols && (
              <FormControlLabel
                className={styles.touchable}
                control={
                  <Switch
                    checked={uprightWanted}
                    onChange={(event) => {
                      setUprightWanted(event.target.checked);
                      setChoice({ upright: event.target.checked });
                    }}
                  />
                }
                label={t(/*i18n*/ "Stand the symbols upright")}
              />
            )}
          </Box>
          {pyramids && <PyramidKey />}
        </div>

        <Box
          // The tablet, its sigil and the note in a sigil's place are drawn
          // on white paper: a light card behind them in dark.
          className={`${plateClass} ${styles.tablet}`}
          sx={{
            "& [data-square]": { cursor: "pointer" },
            // Any square chooses its names in the Names tab: a
            // Watchtower's grid, or the Tablet of Union, which draws in
            // the root.
            ...((onNames || pyramidsShown) && {
              '& svg[viewBox="0 0 244 264"], & > svg[viewBox="0 0 124 104"]': {
                cursor: "pointer",
              },
            }),
            "& > svg": { maxWidth: "100%", height: "auto" },
          }}
        >
          {view ? (
            <Tablet
              tablet={id}
              version={version}
              mirrorReversed={reversed}
              showSecondLetters={alt}
              pyramids={pyramids}
              pyramidSymbols={pyramidSymbols}
              frame
              enochianStyle={enochianFont ? EnochianFont.style : undefined}
              ref={ref}
              highlights={highlights}
            />
          ) : (
            <NoTablet version={version} choose={choose} />
          )}
        </Box>

        <div className={styles.panel}>
          {view && (
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
              <Tab
                value="squares"
                label={t(/*i18n*/ "Squares")}
                id="tablet-tab-squares"
                aria-controls="tablet-tabpanel"
              />
            </Tabs>
          )}
          {view && (
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
                  pyramids={pyramids}
                  symbols={symbols}
                  upright={symbols && uprightWanted}
                  openSquare={
                    hasPyramids(version)
                      ? (square) => choosePyramid(square, true, "names")
                      : undefined
                  }
                />
              ) : onSquares ? (
                <SquaresPanel
                  // Its picker starts again on another tablet's grid.
                  key={id}
                  tablet={id}
                  version={version}
                  view={view}
                  square={pyramidSquare}
                  choose={(square, focus) => choosePyramid(square, focus)}
                  showVersion={() =>
                    choose({ version: DEFAULT_TABLET_VERSION })
                  }
                  detail={detail}
                  focusDetail={focusPyramid}
                  focused={pyramidFocused}
                  announce={announcePyramid}
                  upright={squareUpright}
                  setUpright={setSquareUpright}
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
          )}
          {/* Beside the tablet the downloads come first; on a phone,
              under the tablet, the second letters it draws. */}
          {wide && view && exportControls}
          {altShown && (
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
          {!wide && view && exportControls}
          <div style={{ textAlign: "center", fontSize: "90%" }}>
            Enochian Font:{" "}
            <a href="https://fonts2u.com/enochian-plain.font">enochian-plain</a>
          </div>
        </div>
      </div>

      <ReadingColumn>
        <Box component="section" aria-labelledby="tablet-about" sx={{ mt: 3 }}>
          <Typography variant="h5" component="h2" id="tablet-about">
            {id === "union"
              ? t(/*i18n*/ "The Tablet of Union")
              : `The ${TABLET_NAMES[id]} tablet`}
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
            "/src/app/enochian/tablets/PyramidDetail.tsx",
            "/packages/magick-components/src/enochian/Tablet.tsx",
            "/packages/magick-data/src/enochian/tablets.json5",
            "/packages/magick-data/src/enochian/TabletNames.ts",
            "/packages/magick-data/src/enochian/TabletPyramids.ts",
            "/packages/magick-data/src/enochian/tabletNotes.json5",
          ]}
        />
      </ReadingColumn>
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
      {id === "union" ? (
        <UnionAgrees />
      ) : (
        <Typography variant="body2">
          Outlined on the tablet: where the versions differ in more than case,
          hold second letters, a doubt or a reversed letter, or have a note.
          Choose one, here or on the tablet, to see what each version and source
          has in it.
        </Typography>
      )}
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

/**
 * The Tablet of Union's Differences tab: its letters are the same in all
 * three Golden Dawn sources (a test holds this to the readings), so no
 * square is outlined.
 */
function UnionAgrees() {
  const { t } = useUiLanguage();
  return (
    <Typography variant="body2">
      {t(
        /*i18n*/ "The Tablet of Union reads the same in all three Golden Dawn sources, Regardie's of 1940, the Equinox of 1912 and Greer's edition: no square differs, so none is outlined. Dee's and Raphael's tables have no Tablet of Union.",
      )}
    </Typography>
  );
}

/**
 * In place of the Tablet of Union in a version without one (Dee's and
 * Raphael's): why there is none, and a way to the versions that have it.
 */
function NoTablet({
  version,
  choose,
}: {
  version: TabletVersionId;
  choose: (change: { version: TabletVersionId }) => void;
}) {
  const { t } = useUiLanguage();
  return (
    <Box
      role="note"
      sx={{
        p: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Typography variant="body1">
        {version === "raphael"
          ? t(
              /*i18n*/ "Raphael's table of 1587 has no Tablet of Union. The Tablet of Union is the Golden Dawn's: it sets out the letters of Dee's Black Cross, which binds his four tables together and is not yet drawn here.",
            )
          : t(
              /*i18n*/ "Dee's tables of 1584 have no Tablet of Union. The Tablet of Union is the Golden Dawn's: it sets out the letters of Dee's Black Cross, which binds his four tables together and is not yet drawn here.",
            )}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        sx={{ mt: 1 }}
        onClick={() => choose({ version: DEFAULT_TABLET_VERSION })}
      >
        {t(/*i18n*/ "Show the Golden Dawn's version")}
      </Button>
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
