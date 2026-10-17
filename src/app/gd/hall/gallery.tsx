"use client";

import { GdHall, type HallNode } from "@magick-components/gd/hall";
import {
  HALL_PRESETS,
  type HallPreset,
} from "@magick-components/gd/hall/presets";
import {
  Box,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import React from "react";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";
import { gdHallArt } from "./art";
import { embedGdHallFonts } from "./exportFonts";

/** Plan 061, decision 4: drawing scales, one common size, or both. */
type SizesView = "drawing" | "uniform" | "both";

const SIZE_VIEWS: readonly [SizesView, string][] = [
  ["drawing", "Drawing sizes"],
  ["uniform", "Uniform sizes"],
  ["both", "Both sizes"],
];

const ARCHIVE_SOURCE =
  /^(.*), archive\.org (\S+), p\.(\d+), leaf n(\d+)( \(.+\))?$/;

/** The old drawing a preset was ported from, as served from `public`. */
export function originalDrawing(preset: HallPreset): string | undefined {
  const file = preset.sources.find((source) =>
    /^public\/pics\/\w+\.svg$/.test(source),
  );
  return file?.slice("public".length);
}

/** One source, linked where it has a stable place to go. */
export function Source({ source }: { source: string }) {
  const book = ARCHIVE_SOURCE.exec(source);
  if (book) {
    const [, work, item, page, leaf, note = ""] = book;
    return (
      <>
        {work},{" "}
        <a href={`https://archive.org/details/${item}/page/n${leaf}`}>
          p.{page}
        </a>{" "}
        (archive.org leaf n{leaf}){note}
      </>
    );
  }
  if (source.startsWith("public/"))
    return <a href={source.slice("public".length)}>{source}</a>;
  return <>{source}</>;
}

function Pane({
  preset,
  sizes,
  label,
}: {
  preset: HallPreset;
  sizes: "drawing" | "uniform";
  label?: string;
}) {
  const ref = React.useRef<SVGSVGElement>(null);
  const hall = React.useMemo<HallNode>(
    () => ({ ...preset.hall, sizes }),
    [preset, sizes],
  );
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      {label && (
        <figcaption style={{ textAlign: "center", fontSize: "90%" }}>
          {label}
        </figcaption>
      )}
      <GdHall
        ref={ref}
        hall={hall}
        art={gdHallArt}
        style={{ display: "block", width: "100%", height: "auto" }}
      />
      <ExportControls
        target={ref}
        filename={`gd-hall-${preset.id}${sizes === "uniform" ? "-uniform" : ""}`}
        prepare={embedGdHallFonts}
      />
    </figure>
  );
}

/**
 * The hall presets, read-only (plan 061, stage A): a picker, the old
 * drawing beside the new one, and the two size strategies side by side.
 */
export default function HallGallery() {
  const [id, setId] = React.useState(HALL_PRESETS[0].id);
  const [compare, setCompare] = React.useState(false);
  const [sizes, setSizes] = React.useState<SizesView>("drawing");
  const preset =
    HALL_PRESETS.find((candidate) => candidate.id === id) ?? HALL_PRESETS[0];
  const original = originalDrawing(preset);
  const panes = (sizes === "both" ? 2 : 1) + (compare && original ? 1 : 0);

  return (
    <Container sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Golden Dawn temple halls, drawn from layouts as data with our own
        artwork. Read-only for now: editing halls, and saving them in rituals,
        come later.
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          mb: 2,
        }}
      >
        <FormControl size="small">
          <InputLabel id="gd-hall-preset-label">Hall</InputLabel>
          <Select
            labelId="gd-hall-preset-label"
            value={preset.id}
            label="Hall"
            onChange={(event) => setId(event.target.value)}
          >
            {HALL_PRESETS.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.title} ({candidate.grade})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sizes}
          aria-label="Sizes"
          onChange={(_event, value: SizesView | null) =>
            value && setSizes(value)
          }
        >
          {SIZE_VIEWS.map(([view, label]) => (
            <ToggleButton key={view} value={view}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {original && (
          <FormControlLabel
            control={
              <Switch
                checked={compare}
                onChange={(event) => setCompare(event.target.checked)}
              />
            }
            label="Compare with the original drawing"
          />
        )}
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          alignItems: "start",
          // Side by side on a desktop, stacked on a phone; each pane stays
          // small enough that a whole hall fits on the screen.
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: `repeat(${panes}, minmax(0, 1fr))`,
          },
          maxWidth: { md: panes * 560 },
          mx: "auto",
        }}
      >
        {compare && original && (
          <figure style={{ margin: 0, minWidth: 0 }}>
            <figcaption style={{ textAlign: "center", fontSize: "90%" }}>
              Original drawing
            </figcaption>
            {/* biome-ignore lint/performance/noImgElement: a static SVG shown as drawn */}
            <img
              src={original}
              alt={`The original drawing of the ${preset.title}`}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </figure>
        )}
        {sizes !== "uniform" && (
          <Pane
            preset={preset}
            sizes="drawing"
            label={sizes === "both" || compare ? "Drawing sizes" : undefined}
          />
        )}
        {sizes !== "drawing" && (
          <Pane
            preset={preset}
            sizes="uniform"
            label={sizes === "both" || compare ? "Uniform sizes" : undefined}
          />
        )}
      </Box>
      <Typography variant="subtitle2" component="h2" sx={{ mt: 2 }}>
        Sources
      </Typography>
      <ul style={{ marginTop: 0, overflowWrap: "anywhere" }}>
        {preset.sources.map((source) => (
          <li key={source}>
            <Source source={source} />
          </li>
        ))}
      </ul>
      <OpenSource
        files={[
          "/src/app/gd/hall/gallery.tsx",
          "/src/components/gd/hall/GdHall.tsx",
          "/src/components/gd/hall/presets/index.ts",
        ]}
      />
    </Container>
  );
}
