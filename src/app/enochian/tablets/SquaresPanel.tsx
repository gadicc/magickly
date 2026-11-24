"use client";

import { Box, Button, TextField, Typography } from "@mui/material";
import type { TabletSquare } from "magick-components/enochian/Tablet";
import { tabletPyramid } from "magick-data/enochian/tabletPyramids";
import type { TabletVersionId, TabletView } from "magick-data/enochian/tablets";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { squareInWords } from "./nameWords";
import PyramidDetail from "./PyramidDetail";
import { regionInWords } from "./pyramidWords";
import { versionLetter } from "./squareReadings";
import styles from "./tablets.module.css";
import { hasPyramids } from "./urlState";

/**
 * The Squares tab (plan 095, decision 3): a square of the tablet as the
 * Golden Dawn's truncated pyramid. A square is chosen on the tablet, or
 * by row and square with the picker, or from a name's squares in the
 * Names tab; a choice made by keyboard takes the focus to the detail's
 * heading. Dee's and Raphael's tables carry no elements, so their
 * versions have no pyramids, and the tab says so.
 */
export default function SquaresPanel({
  tablet,
  version,
  view,
  square,
  choose,
  showVersion,
  detail,
  focusDetail,
  focused,
  announce,
  upright,
  setUpright,
}: {
  tablet: string;
  version: TabletVersionId;
  view: TabletView;
  /** The chosen square, by row and column from 0. */
  square: TabletSquare | undefined;
  /** Chooses a square; `focus` takes the focus to its detail. */
  choose: (square: TabletSquare, focus: boolean) => void;
  /** Changes to one of the Golden Dawn's versions. */
  showVersion: () => void;
  /** The detail's box, which a choice on the tablet scrolls into view. */
  detail: React.RefObject<HTMLDivElement | null>;
  /** Whether the detail's heading should take the focus once shown. */
  focusDetail: boolean;
  /** Called once the focus has moved. */
  focused: () => void;
  /**
   * Whether the live region says the square: not when the focus moves to
   * its heading, which says it.
   */
  announce: boolean;
  /** Whether the pyramid's symbols stand upright, kept for the session. */
  upright: boolean;
  setUpright: (upright: boolean) => void;
}) {
  const { t } = useUiLanguage();
  const heading = React.useRef<HTMLHeadingElement>(null);
  const rows = view.grid.length;
  const columns = Math.max(...view.grid.map((row) => row.length));
  // The picker shows the chosen square, and keeps its own choice until
  // "Show". The page mounts it afresh for each tablet; it is held to the
  // grid all the same, so it never offers a square the selects do not.
  const [choice, setPicked] = React.useState({
    row: square?.row ?? 0,
    column: square?.column ?? 0,
  });
  const [pickedFor, setPickedFor] = React.useState(square);
  if (pickedFor !== square) {
    setPickedFor(square);
    if (square) setPicked({ row: square.row, column: square.column });
  }
  const picked = {
    row: Math.min(choice.row, rows - 1),
    column: Math.min(choice.column, columns - 1),
  };
  const pyramid = square ? tabletPyramid(view, square) : undefined;
  React.useEffect(() => {
    if (!focusDetail || !pyramid) return;
    heading.current?.focus();
    focused();
  }, [focusDetail, pyramid, focused]);

  if (!hasPyramids(version))
    return (
      <Box component="section" aria-labelledby="tablet-pyramids">
        <Typography variant="h5" component="h2" id="tablet-pyramids">
          {t(/*i18n*/ "Squares as pyramids")}
        </Typography>
        <Typography variant="body2" role="note" data-no-pyramids="">
          {t(
            /*i18n*/ "Dee's and Raphael's tables carry no elements, so their squares are not pyramids. The pyramids are the Golden Dawn's, in its three versions.",
          )}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          sx={{ mt: 1, minHeight: 44 }}
          onClick={showVersion}
        >
          {t(/*i18n*/ "Show the Golden Dawn's version")}
        </Button>
      </Box>
    );

  const numbers = (count: number) =>
    Array.from({ length: count }, (_, index) => index);
  return (
    <Box component="section" aria-labelledby="tablet-pyramids">
      <Typography variant="h5" component="h2" id="tablet-pyramids">
        {t(/*i18n*/ "Squares as pyramids")}
      </Typography>
      <Typography variant="body2">
        {t(
          /*i18n*/ "The Golden Dawn treats every square as a truncated pyramid, with an element and an attribution on each of its four sides. Choose a square on the tablet, or a row and square here, to see its pyramid, the rule it follows and, below the cross bars, its angels, god and sphinx.",
        )}
      </Typography>
      <Box
        component="form"
        className={styles.picker}
        aria-label={t(/*i18n*/ "Choose a square")}
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          choose(picked, true);
        }}
      >
        <TextField
          select
          label={t(/*i18n*/ "Row")}
          value={picked.row}
          onChange={(event) =>
            setPicked({ ...picked, row: Number(event.target.value) })
          }
          slotProps={{ select: { native: true } }}
        >
          {numbers(rows).map((row) => (
            <option key={row} value={row}>
              {row + 1}
            </option>
          ))}
        </TextField>
        <TextField
          select
          label={t(/*i18n*/ "Square")}
          value={picked.column}
          onChange={(event) =>
            setPicked({ ...picked, column: Number(event.target.value) })
          }
          slotProps={{ select: { native: true } }}
        >
          {numbers(columns).map((column) => (
            <option key={column} value={column}>
              {column + 1}
            </option>
          ))}
        </TextField>
        <Button type="submit" variant="outlined" sx={{ minHeight: 44 }}>
          {t(/*i18n*/ "Show")}
        </Button>
      </Box>
      {/* Heard, not seen: the detail shows it. */}
      <Typography variant="body2" aria-live="polite" sx={visuallyHidden}>
        {square && pyramid && announce
          ? t(/*i18n*/ "{square}: {region}", {
              square: squareInWords(square, t),
              region: regionInWords(pyramid, tablet, t),
            })
          : ""}
      </Typography>
      <div ref={detail} className={styles.namesItem}>
        {pyramid && (
          <PyramidDetail
            tablet={tablet}
            version={version}
            pyramid={pyramid}
            letter={versionLetter(view, pyramid.row, pyramid.column)}
            heading={heading}
            upright={upright}
            setUpright={setUpright}
          />
        )}
      </div>
    </Box>
  );
}
