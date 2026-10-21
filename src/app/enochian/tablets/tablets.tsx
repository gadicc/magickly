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
} from "@mui/material";
import tabletNotes, {
  type SquareNote,
  sourceText,
  sourceUrl,
  squareNotes,
  type TabletSource,
  type TabletTopic,
} from "magick-data/enochian/tabletNotes";
import React from "react";
import Tablet, { type TabletSquare } from "@/components/enochian/Tablet";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";
import { componentImageFilename } from "@/render/componentImageUrl";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";
import useEnochianFont, { EnochianFont } from "../useEnochianFont";

const TABLET_NAMES: Record<(typeof TABLET_IDS)[number], string> = {
  earth: "Earth",
  air: "Air",
  water: "Water",
  fire: "Fire",
};

/** "Row 5, square 12", counting from 1 as a reader does. */
const squareName = ({ row, column }: TabletSquare) =>
  `Row ${row + 1}, square ${column + 1}`;

/** One line for the live region: the square and what each source prints. */
const squareSummary = (note: SquareNote) =>
  `${squareName(note)}: Regardie ${note.printed.regardie1940}; the Equinox ${note.printed.equinox1912}; Greer ${note.printed.greer}`;

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

/** What each source prints in a square, the note on it, and its sources. */
function SquareDetail({ note }: { note: SquareNote }) {
  const printed = [
    ["Regardie, 1940", note.printed.regardie1940],
    ["The Equinox, 1912", note.printed.equinox1912],
    ["Greer's edition", note.printed.greer],
  ] as const;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle1" component="h4">
        {squareName(note)}
      </Typography>
      <Typography component="dl" variant="body2" sx={{ m: 0 }}>
        {printed.map(([source, letters]) => (
          <Box key={source} sx={{ display: "flex", gap: 1 }}>
            <dt>{source}:</dt>
            <dd style={{ margin: 0 }}>{letters}</dd>
          </Box>
        ))}
      </Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>
        {note.note}
      </Typography>
      <Sources sources={note.sources} />
    </Box>
  );
}

export default function Tablets() {
  const [id, setId] = React.useState<(typeof TABLET_IDS)[number]>("earth");
  const [showSquares, setShowSquares] = React.useState(false);
  const [selected, setSelected] = React.useState<TabletSquare>();
  const { EnochianFontToggle, enochianFont } = useEnochianFont();
  const ref = React.useRef<SVGSVGElement>(null);
  const link = {
    slug: "enochian-tablet" as const,
    props: {
      id,
      font: enochianFont ? ("enochian" as const) : ("latin" as const),
    },
  };
  const notes = squareNotes(id);
  const detail = React.useRef<HTMLDivElement>(null);
  const [scrollToDetail, setScrollToDetail] = React.useState(false);
  const chosen = selected
    ? notes.find(
        (note) => note.row === selected.row && note.column === selected.column,
      )
    : undefined;
  const tabletNote = tabletNotes.tablets[id];
  /**
   * A square chosen on the tablet: a second tap on it clears it, as its
   * button does, and its detail, which may be off a phone's screen below
   * the list, is scrolled into view.
   */
  const pickOnTablet = (square: TabletSquare) => {
    const same = chosen?.row === square.row && chosen?.column === square.column;
    setSelected(same ? undefined : square);
    setScrollToDetail(!same);
  };
  React.useEffect(() => {
    if (!scrollToDetail) return;
    setScrollToDetail(false);
    detail.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [scrollToDetail]);

  return (
    <Container sx={{ p: 2 }}>
      <FormControl>
        <InputLabel id="demo-simple-select-label">Tablet</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={id}
          label="Tablet"
          onChange={(e) => {
            setId(e.target.value as (typeof TABLET_IDS)[number]);
            setSelected(undefined);
          }}
        >
          {TABLET_IDS.map((tablet) => (
            <MenuItem key={tablet} value={tablet}>
              {TABLET_NAMES[tablet]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <EnochianFontToggle />
      <FormControlLabel
        sx={{ ml: 1 }}
        control={
          <Switch
            checked={showSquares}
            onChange={(event) => setShowSquares(event.target.checked)}
          />
        }
        label="Show where the sources differ"
      />
      <br />
      <br />

      <Box sx={{ "& [data-square]": { cursor: "pointer" } }}>
        <Tablet
          id={id}
          enochianStyle={enochianFont ? EnochianFont.style : undefined}
          ref={ref}
          highlights={
            showSquares
              ? { squares: notes, selected: chosen, onSelect: pickOnTablet }
              : undefined
          }
        />
      </Box>
      <ExportControls
        target={ref}
        filename={componentImageFilename(link)}
        // The image link draws the tablet alone; the downloads draw what is
        // shown, the outlines too.
        link={showSquares ? undefined : link}
        linkNote={
          showSquares ? "No image link while differences are shown." : undefined
        }
      />
      <div style={{ textAlign: "center", fontSize: "90%" }}>
        Enochian Font:{" "}
        <a href="https://fonts2u.com/enochian-plain.font">enochian-plain</a>
      </div>

      <Box component="section" aria-labelledby="tablet-about" sx={{ mt: 3 }}>
        <Typography variant="h5" component="h2" id="tablet-about">
          The {TABLET_NAMES[id]} tablet
        </Typography>
        <Typography variant="body1">{tabletNote.text}</Typography>
        <Sources sources={tabletNote.sources} />
        {showSquares && (
          <Box
            component="section"
            aria-labelledby="tablet-squares"
            sx={{ mt: 2 }}
          >
            <Typography variant="h6" component="h3" id="tablet-squares">
              Squares where the sources differ
            </Typography>
            <Typography variant="body2">
              Outlined on the tablet. Choose one, here or on the tablet, to see
              what each source prints in it.
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
              {notes.map((note) => {
                const isChosen =
                  chosen?.row === note.row && chosen?.column === note.column;
                return (
                  <li key={`${note.row},${note.column}`}>
                    <Button
                      size="small"
                      variant={isChosen ? "contained" : "outlined"}
                      aria-pressed={isChosen}
                      onClick={() => setSelected(isChosen ? undefined : note)}
                    >
                      {squareName(note)}
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
              {chosen ? squareSummary(chosen) : ""}
            </Typography>
            <div ref={detail}>{chosen && <SquareDetail note={chosen} />}</div>
          </Box>
        )}
      </Box>

      <Box
        component="section"
        aria-labelledby="tablets-versions"
        sx={{ mt: 3 }}
      >
        <Typography variant="h5" component="h2" id="tablets-versions">
          About these tablets
        </Typography>
        <Typography variant="h6" component="h3" sx={{ mt: 1 }}>
          Versions
        </Typography>
        {tabletNotes.versions.map((topic) => (
          <Topic key={topic.id} topic={topic} />
        ))}
        <Typography variant="h6" component="h3" sx={{ mt: 1 }}>
          How they differ
        </Typography>
        {tabletNotes.differences.map((topic) => (
          <Topic key={topic.id} topic={topic} />
        ))}
        <Typography variant="body2" sx={{ mt: 1 }}>
          {tabletNotes.tablets.union.text}
        </Typography>
      </Box>
      <br />
      <OpenSource
        files={[
          "/src/app/enochian/tablets/tablets.tsx",
          "/src/components/enochian/Tablet.tsx",
          "/packages/magick-data/src/enochian/tablets.json5",
          "/packages/magick-data/src/enochian/tabletNotes.json5",
        ]}
      />
    </Container>
  );
}
