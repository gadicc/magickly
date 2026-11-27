"use client";

import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import {
  REGION_HATCH,
  REGION_TINTS,
  type TabletSquare,
  tabletGround,
} from "magick-components/enochian/Tablet";
import {
  TABLET_QUARTERS,
  type TabletName,
  type TabletNameId,
  tabletNameVariants,
} from "magick-data/enochian/tabletNames";
import tabletNotes, {
  attributionNote,
  citedSpellings,
  dictionarySpellings,
  nameRules,
} from "magick-data/enochian/tabletNotes";
import tablets, {
  type EnochianTabletID,
  type TabletVersionId,
} from "magick-data/enochian/tablets";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { visuallyHidden } from "@/ui/visuallyHidden";
import {
  dictionaryHref,
  linkedHeadword,
  type TabletNameLinks,
} from "./dictionaryLinks";
import {
  displayName,
  type GroupKey,
  groupLabel,
  groupOf,
  nameInWords,
  nameLabel,
  shownName,
  squareInWords,
  type Tradition,
  type Translate,
} from "./nameWords";
import { Sources, versionTitle } from "./Sources";
import styles from "./tablets.module.css";
import { tabletQuery } from "./urlState";

const sameSquare = (a: TabletSquare, b: TabletSquare) =>
  a.row === b.row && a.column === b.column;

/** The names whose paths go through a square. */
export const namesThrough = (
  names: readonly TabletName[],
  square: TabletSquare,
) =>
  names.filter((name) => name.squares.some((each) => sameSquare(each, square)));

/**
 * Whether `name` is an archangel built on `base`: a Kerubic or servient
 * name with its letter of the Tablet of Union, on exactly the base's
 * Watchtower squares.
 */
export const builtOn = (name: TabletName, base: TabletName) =>
  Boolean(name.unionLetter) &&
  !base.unionLetter &&
  name.squares.length === base.squares.length &&
  name.squares.every((square, index) =>
    sameSquare(square, base.squares[index] as TabletSquare),
  );

/**
 * The names through a square that a tap on it chooses between: the
 * archangels built on another of them left out, since each is that
 * name's with a letter of the Union before it and its detail offers
 * them. A servient or top-row square is then one name, as before the
 * archangels; a cross square still several.
 */
export const namesToChoose = (
  names: readonly TabletName[],
  square: TabletSquare,
) => {
  const through = namesThrough(names, square);
  return through.filter((name) => !through.some((base) => builtOn(name, base)));
};

/** Whether the reader asked for less motion. */
const still = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Scrolls an element of the list into view, as little as it can. */
const reveal = (element: Element | null | undefined) =>
  element?.scrollIntoView?.({
    block: "nearest",
    behavior: still() ? "instant" : "smooth",
  });

/**
 * The Names tab (plan 090, decision 5): the "Show the regions" switch and
 * its key (a Watchtower's only), a square's names to choose from when one
 * chosen on the tablet lies in several, the names grouped as the tablet
 * is built, and a live region that says the chosen name and its squares.
 */
export default function NamesPanel({
  tablet,
  version,
  tradition,
  names,
  chosen,
  choose,
  preview,
  regions,
  setRegions,
  square,
  clearSquare,
  links,
  revealed,
  openSquare,
  pyramids = false,
  symbols = false,
  upright = false,
  threeD = false,
}: {
  tablet: EnochianTabletID;
  version: TabletVersionId;
  tradition: Tradition;
  names: readonly TabletName[];
  chosen: TabletName | undefined;
  /** Pins a name, or lets it go with `undefined`. */
  choose: (id: TabletNameId | undefined) => void;
  /** Previews a name on the tablet, or stops with `undefined`. */
  preview: (id: TabletNameId | undefined) => void;
  regions: boolean;
  setRegions: (on: boolean) => void;
  /** A square chosen on the tablet that lies in several names. */
  square: TabletSquare | undefined;
  clearSquare: () => void;
  links: TabletNameLinks | undefined;
  /** Moves each time a choice on the tablet should be brought into view. */
  revealed: number;
  /**
   * Opens the Squares tab at a square, where the version has pyramids
   * (plan 095, decision 3); none in Dee's and Raphael's.
   */
  openSquare?: (square: TabletSquare) => void;
  /** The tablet drawn as pyramids, which a square's link keeps. */
  pyramids?: boolean;
  /** Their sides' symbols, which a square's link keeps too. */
  symbols?: boolean;
  /** The symbols upright, which a square's link keeps too. */
  upright?: boolean;
  /**
   * The pyramids in 3D (plan 101), which a square's link keeps, and which
   * draws no regions, so their switch rests.
   */
  threeD?: boolean;
}) {
  const { t } = useUiLanguage();
  const [expanded, setExpanded] = React.useState<ReadonlySet<GroupKey>>(
    () => new Set(["cross", "union"]),
  );
  // A name chosen from the tablet or from another's detail opens its group.
  const [openedFor, setOpenedFor] = React.useState<string>();
  if (chosen?.id !== openedFor) {
    setOpenedFor(chosen?.id);
    if (chosen && !expanded.has(groupOf(chosen)))
      setExpanded(new Set([...expanded, groupOf(chosen)]));
  }
  const panel = React.useRef<HTMLDivElement>(null);
  // Focus the chosen name's button after a choice made from a button that
  // goes away with it (another name's detail, a square's names).
  const focusChosen = React.useRef(false);
  React.useEffect(() => {
    if (!focusChosen.current || !chosen) return;
    focusChosen.current = false;
    const button = panel.current?.querySelector<HTMLElement>(
      `[data-name-id="${chosen.id}"]`,
    );
    button?.focus();
    reveal(button?.closest("li"));
  }, [chosen]);
  // A choice on the tablet: the chosen name's place in the list, or the
  // names through the chosen square.
  // Not on mounting, as when the tab is opened again after a choice.
  const revealedOnMount = React.useRef(revealed);
  React.useEffect(() => {
    if (revealed === revealedOnMount.current) return;
    reveal(
      panel.current?.querySelector(
        "[data-square-choice], li[data-chosen='true']",
      ),
    );
  }, [revealed]);

  const pick = (id: TabletNameId) => {
    focusChosen.current = true;
    choose(id);
  };
  const through = square ? namesThrough(names, square) : [];
  const union = tablet === "union";
  const groups: GroupKey[] = union ? ["union"] : ["cross", ...TABLET_QUARTERS];

  return (
    <Box ref={panel}>
      <Typography variant="h5" component="h2" id="tablet-names">
        {t(/*i18n*/ "Names on the tablet")}
      </Typography>
      <Typography variant="body2">
        {t(
          /*i18n*/ "Choose a name to see where it is read: the rest of the tablet is dimmed, a flag marks its first square, and on a large enough screen each square is numbered in reading order. Choose it again to let it go, or tap a square to find the names through it.",
        )}
      </Typography>
      {/* The regions are a Watchtower's crosses and rows. */}
      {!union && (
        <FormControlLabel
          disabled={threeD}
          control={
            <Switch
              checked={regions}
              onChange={(event) => setRegions(event.target.checked)}
            />
          }
          label={t(/*i18n*/ "Show the regions")}
        />
      )}
      {regions && !union && <RegionKey tablet={tablet} t={t} />}
      {/* Heard, not seen: the square's box and the name's detail show it. */}
      <Typography variant="body2" aria-live="polite" sx={visuallyHidden}>
        {square
          ? t(/*i18n*/ "{square}: in {count} names. Choose one below.", {
              square: squareInWords(square, t),
              count: through.length,
            })
          : chosen
            ? nameInWords(chosen, tradition, t)
            : ""}
      </Typography>
      {square && (
        <Box
          data-square-choice=""
          className={styles.namesItem}
          sx={{
            my: 1,
            p: 1,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {t(/*i18n*/ "The names through row {row}, square {column}", {
              row: square.row + 1,
              column: square.column + 1,
            })}
          </Typography>
          <Box component="ul" sx={{ listStyle: "none", p: 0, my: 0.5 }}>
            {through.map((name) => (
              <li key={name.id}>
                <Button
                  size="small"
                  sx={{ textTransform: "none", textAlign: "start" }}
                  onClick={() => pick(name.id)}
                >
                  {`${shownName(name, t)} · ${nameLabel(name, tradition, t)}`}
                </Button>
              </li>
            ))}
          </Box>
          <Button size="small" variant="outlined" onClick={clearSquare}>
            {t(/*i18n*/ "Clear the square")}
          </Button>
        </Box>
      )}
      {groups.map((group) => {
        const members = names.filter((name) => groupOf(name) === group);
        if (!members.length) return null;
        return (
          <Accordion
            key={group}
            disableGutters
            expanded={expanded.has(group)}
            onChange={(_event, open) =>
              setExpanded((was) => {
                const next = new Set(was);
                if (open) next.add(group);
                else next.delete(group);
                return next;
              })
            }
            slotProps={{ transition: { unmountOnExit: true } }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls={`names-${group}-content`}
              id={`names-${group}-header`}
            >
              <Typography component="span">
                {groupLabel(
                  group === "cross" || group === "union" ? undefined : group,
                  tablet,
                  tradition,
                  t,
                )}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box
                component="ul"
                aria-labelledby={`names-${group}-header`}
                sx={{ listStyle: "none", p: 0, m: 0 }}
              >
                {members.map((name) => {
                  const isChosen = chosen?.id === name.id;
                  return (
                    <li
                      key={name.id}
                      data-chosen={isChosen}
                      className={styles.namesItem}
                    >
                      <Button
                        data-name-id={name.id}
                        aria-pressed={isChosen}
                        color="inherit"
                        onClick={() => choose(isChosen ? undefined : name.id)}
                        onMouseEnter={() => preview(name.id)}
                        onMouseLeave={() => preview(undefined)}
                        onFocus={() => preview(name.id)}
                        onBlur={() => preview(undefined)}
                        sx={{
                          justifyContent: "flex-start",
                          // The spellings line up at the start, in either
                          // direction.
                          textAlign: "start",
                          textTransform: "none",
                          width: "100%",
                          gap: 2,
                          // Chosen: a light tint of the primary colour,
                          // as a selected list item, not a filled button.
                          ...(isChosen && {
                            bgcolor:
                              "rgba(var(--mui-palette-primary-mainChannel) / 0.14)",
                            "&:hover": {
                              bgcolor:
                                "rgba(var(--mui-palette-primary-mainChannel) / 0.22)",
                            },
                          }),
                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: "-2px",
                          },
                        }}
                      >
                        <Box
                          component="span"
                          sx={{ fontWeight: "bold", minWidth: "6.5em" }}
                        >
                          {shownName(name, t)}
                          {/* Heard between the name and its role, which
                              the layout keeps apart for the eye. */}
                          <span style={visuallyHidden}>,</span>
                        </Box>{" "}
                        <Box component="span" sx={{ fontSize: "0.85em" }}>
                          {nameLabel(name, tradition, t)}
                        </Box>
                      </Button>
                      {isChosen && (
                        <NameDetail
                          name={name}
                          tablet={tablet}
                          version={version}
                          tradition={tradition}
                          names={names}
                          links={links}
                          pick={pick}
                          openSquare={openSquare}
                          pyramids={pyramids}
                          symbols={symbols}
                          upright={upright}
                          threeD={threeD}
                          t={t}
                        />
                      )}
                    </li>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

/** A small swatch for the regions' key. */
function Swatch({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      aria-hidden
      style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
    >
      {children}
      <rect
        x={0.5}
        y={0.5}
        width={15}
        height={15}
        style={{ fill: "none", stroke: "#888" }}
      />
    </svg>
  );
}

/** What each region's tint or hatch means, on this tablet's ground. */
function RegionKey({ tablet, t }: { tablet: string; t: Translate }) {
  const ground = tabletGround(tablet) ?? "white";
  const tint = (region: keyof typeof REGION_TINTS) => (
    <Swatch>
      <rect width={16} height={16} style={{ fill: "white" }} />
      <rect
        width={16}
        height={16}
        style={{
          fill: REGION_TINTS[region].fill,
          fillOpacity: REGION_TINTS[region].opacity,
        }}
      />
    </Swatch>
  );
  const items = [
    [tint("greatCross"), t(/*i18n*/ "The Great Cross")],
    [tint("calvaryCross"), t(/*i18n*/ "The Calvary crosses")],
    [
      <Swatch key="top">
        <rect width={16} height={16} style={{ fill: ground }} />
        <path
          d="M0 7L7 0M0 14L14 0M5 16L16 5M12 16L16 12"
          style={{
            stroke: REGION_HATCH.stroke,
            strokeOpacity: REGION_HATCH.opacity,
            strokeWidth: REGION_HATCH.width,
          }}
        />
      </Swatch>,
      t(/*i18n*/ "The top rows, hatched"),
    ],
    [
      <Swatch key="servient">
        <rect width={16} height={16} style={{ fill: ground }} />
      </Swatch>,
      t(/*i18n*/ "The servient squares, left plain"),
    ],
  ] as const;
  return (
    <Box
      component="ul"
      aria-label={t(/*i18n*/ "The regions' key")}
      sx={{
        listStyle: "none",
        p: 0,
        my: 0.5,
        display: "flex",
        flexWrap: "wrap",
        columnGap: 2,
        rowGap: 0.5,
      }}
    >
      {items.map(([swatch, label]) => (
        <Typography component="li" variant="body2" key={label}>
          {swatch}
          {label}
        </Typography>
      ))}
    </Box>
  );
}

/** A labelled line of the detail, or a label alone above a list. */
function Line({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Typography variant="body2" sx={{ mt: 0.5 }}>
      <Box component="span" sx={{ fontWeight: "bold" }}>
        {label}
      </Box>
      {children !== undefined && <> {children}</>}
    </Typography>
  );
}

/**
 * A chosen name's detail, under it in the list: its squares in words,
 * its letters, rotations, how the other versions and the sources spell
 * it, where it is read, its dictionary entry and the other names through
 * its squares.
 */
function NameDetail({
  name,
  tablet,
  version,
  tradition,
  names,
  links,
  pick,
  openSquare,
  pyramids,
  symbols,
  upright,
  threeD,
  t,
}: {
  name: TabletName;
  tablet: EnochianTabletID;
  version: TabletVersionId;
  tradition: Tradition;
  names: readonly TabletName[];
  links: TabletNameLinks | undefined;
  pick: (id: TabletNameId) => void;
  openSquare?: (square: TabletSquare) => void;
  pyramids: boolean;
  symbols: boolean;
  upright: boolean;
  threeD: boolean;
  t: Translate;
}) {
  const variants = tabletNameVariants(tablets[tablet], name.id, version);
  const cited = citedSpellings(tablet, name.id);
  const theirs = dictionarySpellings(tablet, name.id);
  const rules = nameRules(name.kind, version);
  // The notes' attributions are a Watchtower's quarters and planets; the
  // Union's lines have their element in their rule.
  const attribution =
    tradition === "gd" && name.attribution && tablet !== "union"
      ? attributionNote(name.attribution.element ? "element" : "planet")
      : undefined;
  const headword = linkedHeadword(links, tablet, version, name.id);
  // The archangel built on this name first, then the rest in order.
  const others = names
    .filter(
      (other) =>
        other.id !== name.id &&
        other.squares.some((square) =>
          name.squares.some((own) => sameSquare(own, square)),
        ),
    )
    .sort((a, b) => Number(builtOn(b, name)) - Number(builtOn(a, name)));
  return (
    <Box
      sx={{
        mx: 1,
        mb: 1.5,
        p: 1,
        borderInlineStart: 3,
        borderColor: "primary.main",
      }}
    >
      <Typography variant="body2">{nameInWords(name, tradition, t)}</Typography>
      <Line label={t(/*i18n*/ "This version's letters:")}>
        {(name.spellings ?? [name.spelling]).join(" / ")}
      </Line>
      {name.rotations && name.rotations.length > 1 && (
        <Line label={t(/*i18n*/ "Rotations:")}>
          {name.rotations.map(displayName).join(", ")}
        </Line>
      )}
      {variants.length > 0 && (
        <>
          <Line label={t(/*i18n*/ "In the other versions:")} />
          <Box component="ul" sx={{ pl: 3, my: 0 }}>
            {variants.map((variant) => (
              <Typography
                component="li"
                variant="body2"
                key={variant.versions.join()}
              >
                {`${(variant.spellings ?? [variant.spelling])
                  .map(displayName)
                  .join(" / ")} (${variant.versions
                  .map(versionTitle)
                  .join("; ")})`}
              </Typography>
            ))}
          </Box>
        </>
      )}
      {cited.length > 0 && (
        <>
          <Line label={t(/*i18n*/ "Spelled otherwise in the sources:")} />
          {cited.map((each) => (
            <Box key={each.spelling} sx={{ pl: 1 }}>
              <Typography variant="body2">
                {`${each.spelling}: ${each.text}`}
              </Typography>
              <Sources sources={each.sources} />
            </Box>
          ))}
        </>
      )}
      {theirs.length > 0 && (
        <>
          <Line label={t(/*i18n*/ "The dictionary's spelling:")}>
            {theirs.map((each) => each.spelling).join(", ")}
          </Line>
          <Typography variant="body2" sx={{ pl: 1 }}>
            {tabletNotes.names.dictionary.text}
          </Typography>
        </>
      )}
      {(rules.length > 0 || attribution) && (
        <>
          <Line label={t(/*i18n*/ "Where it is read:")} />
          {rules.map((rule) => (
            <Box key={rule.text} sx={{ pl: 1 }}>
              <Typography variant="body2">{rule.text}</Typography>
              <Sources sources={rule.sources} />
            </Box>
          ))}
          {attribution && (
            <Box sx={{ pl: 1 }}>
              <Typography variant="body2">{attribution.text}</Typography>
              <Sources sources={attribution.sources} />
            </Box>
          )}
        </>
      )}
      {headword && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          <a href={dictionaryHref(headword)}>
            {t(/*i18n*/ "{word} in the dictionary", { word: headword })}
          </a>
        </Typography>
      )}
      {openSquare && (
        <>
          <Line label={t(/*i18n*/ "Its squares as pyramids:")} />
          <Box
            component="ul"
            sx={{
              listStyle: "none",
              p: 0,
              my: 0.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            {name.squares.map((square) => (
              <li key={`${square.row},${square.column}`}>
                {/* A link to the Squares tab at the square, which the
                    page opens in place; a new tab opens the same view. */}
                <Button
                  size="small"
                  variant="outlined"
                  href={tabletQuery({
                    tablet,
                    version,
                    tab: "squares",
                    square,
                    pyramids,
                    symbols,
                    upright,
                    threeD,
                  })}
                  onClick={(event: React.MouseEvent) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey)
                      return;
                    event.preventDefault();
                    openSquare(square);
                  }}
                  sx={{ textTransform: "none", minHeight: 44 }}
                >
                  {squareInWords(square, t)}
                </Button>
              </li>
            ))}
          </Box>
        </>
      )}
      {others.length > 0 && (
        <>
          <Line label={t(/*i18n*/ "The other names through its squares:")} />
          <Box
            component="ul"
            sx={{
              listStyle: "none",
              p: 0,
              my: 0.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            {others.map((other) => (
              <li key={other.id}>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: "none" }}
                  onClick={() => pick(other.id)}
                >
                  {`${shownName(other, t)} · ${nameLabel(other, tradition, t)}`}
                </Button>
              </li>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
