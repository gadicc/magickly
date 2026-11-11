"use client";

import { estimateHallAspect } from "@magick-components/gd/hall/aspect";
import type { HallNode } from "@magick-components/gd/hall/types";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Dialog,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import React from "react";
import { DARK_SELECTOR } from "@/colorScheme";
import { GdHallFrame } from "@/doc/ritualBlocks/GdHallFrame";
import type { RitualHall } from "@/doc/ritualHalls";
import { HallPanZoom } from "./HallPanZoom";

const hallOf = (hall: RitualHall) => hall.row as unknown as HallNode;

/**
 * A ritual's halls as a bottom sheet (plan 069, mock-up B): each with a
 * small drawing, its name and its context. The drawings carry no id, so
 * the reader's `hall-N` anchors stay unique.
 */
export function HallSheet({
  open,
  halls,
  onClose,
  onPick,
}: {
  open: boolean;
  halls: readonly RitualHall[];
  onClose: () => void;
  /** The index, in `halls`, of the hall picked. */
  onPick: (index: number) => void;
}) {
  const titleId = React.useId();
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": titleId,
          sx: {
            maxHeight: "75vh",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxWidth: 640,
            mx: "auto",
          },
        },
      }}
    >
      <Typography
        id={titleId}
        component="h2"
        variant="subtitle1"
        sx={{ px: 2, py: 1.5, fontWeight: 500 }}
      >
        Halls in this ritual
      </Typography>
      <List disablePadding sx={{ overflowY: "auto" }}>
        {halls.map((hall, index) => (
          <ListItemButton
            key={hall.ordinal}
            divider
            onClick={() => onPick(index)}
            sx={{ gap: 2 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 88,
                flexShrink: 0,
                pointerEvents: "none",
                "& > figure": { margin: 0 },
              }}
            >
              <GdHallFrame hall={hallOf(hall)} />
            </Box>
            <ListItemText primary={hall.name} secondary={hall.context} />
            <ChevronRightIcon color="action" />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}

/**
 * One hall full screen (plan 069, mock-up C): its name, context and place
 * among the ritual's halls, the drawing with pan and zoom, previous and
 * next, and "Go to it in the ritual". `index` is the hall shown, or null
 * when closed; the last hall stays drawn while the dialog closes. `halls`
 * must not be empty.
 */
export function HallViewer({
  halls,
  index,
  onIndexChange,
  onClose,
  onGoTo,
}: {
  halls: readonly RitualHall[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onGoTo: (hall: RitualHall) => void;
}) {
  const titleId = React.useId();
  const last = React.useRef(0);
  if (index !== null) last.current = index;
  // `halls` is never empty (the reader offers no Halls action then); it may
  // shrink if the ritual changes while the viewer is open.
  const shown = Math.min(index ?? last.current, halls.length - 1);
  const hall = halls[shown];
  const aspect = React.useMemo(() => estimateHallAspect(hallOf(hall)), [hall]);
  const previous = shown > 0 ? shown - 1 : null;
  const next = shown < halls.length - 1 ? shown + 1 : null;

  // Stepping to the first or last hall disables the arrow just used; focus
  // moves to the other one rather than falling to the page.
  const previousButton = React.useRef<HTMLButtonElement>(null);
  const nextButton = React.useRef<HTMLButtonElement>(null);
  const refocus = React.useRef(false);
  React.useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    if (previous === null) nextButton.current?.focus();
    else if (next === null) previousButton.current?.focus();
  }, [previous, next]);
  const step = (to: number | null, viaButton: boolean) => {
    if (to === null) return;
    refocus.current = viaButton;
    onIndexChange(to);
  };

  return (
    <Dialog
      fullScreen
      open={index !== null}
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: { display: "flex", flexDirection: "column" } },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 1,
          borderBottom: "1px solid #e0e0e0",
          [DARK_SELECTOR]: { borderColor: "divider" },
        }}
      >
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
        {/* Announced as a whole when the hall changes. */}
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id={titleId} component="h2" variant="h6" noWrap>
              {hall.name}
            </Typography>
            {hall.context && (
              <Typography variant="body2" color="textSecondary" noWrap>
                {hall.context}
              </Typography>
            )}
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ px: 1 }}>
            {`${shown + 1} of ${halls.length}`}
          </Typography>
        </Box>
      </Box>
      <HallPanZoom
        // A new hall starts at 1×.
        key={hall.ordinal}
        aspect={aspect}
        active={index !== null}
        onSwipe={(direction) =>
          step(direction === "next" ? next : previous, false)
        }
      >
        <GdHallFrame hall={hallOf(hall)} />
      </HallPanZoom>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 1.5,
          borderTop: "1px solid #e0e0e0",
          [DARK_SELECTOR]: { borderColor: "divider" },
        }}
      >
        <IconButton
          ref={previousButton}
          aria-label="Previous hall"
          disabled={previous === null}
          onClick={() => step(previous, true)}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Button variant="contained" onClick={() => onGoTo(hall)}>
          Go to it in the ritual
        </Button>
        <IconButton
          ref={nextButton}
          aria-label="Next hall"
          disabled={next === null}
          onClick={() => step(next, true)}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Dialog>
  );
}
