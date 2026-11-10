"use client";

import { Box } from "@mui/material";
import letters from "magick-data/enochian/letters";
import EnochianFont from "../../../components/enochian/enochianFont";
import { LABELS } from "./labels";

/** The 21 letters, in the order the letters table gives them (A to Z). */
const KEYS = Object.values(letters).map((letter) => ({
  id: letter.id,
  name: letter.title,
  latin: letter.english.replaceAll(",", " "),
}));

/** Keeps the box's focus and caret: a key is pressed, never focused. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const styles = {
  zIndex: 3,
  bgcolor: "background.default",
  borderTop: 1,
  borderColor: "divider",
  padding: "8px 6px 10px",
  "&.keypad-docked": {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
  },
  "&.keypad-dropdown": {
    position: "absolute",
    top: "100%",
    left: 16,
    right: 16,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    boxShadow: 6,
  },
  "& .keypad-bar": {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 6px 6px",
    fontSize: 12,
    color: "text.secondary",
  },
  "& .keypad-actions": { display: "flex", gap: "4px" },
  "& .keypad-grid": {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "6px",
    // The script runs right to left, so A is at the right.
    direction: "rtl",
  },
  "& button": {
    font: "inherit",
    color: "text.primary",
    bgcolor: "background.paper",
    border: 1,
    borderColor: "divider",
    borderRadius: 1.5,
    cursor: "pointer",
    touchAction: "manipulation",
  },
  "& .keypad-key": {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4px 0 2px",
    minHeight: 48,
  },
  "& .keypad-glyph": { fontSize: 24, lineHeight: "28px" },
  "& .keypad-latin": { fontSize: 10.5, color: "text.secondary" },
  "& .keypad-action": { padding: "4px 10px", fontSize: 13 },
} as const;

/**
 * The Enochian letters as keys (plan 074, decisions 2 and 4): docked at the
 * foot of a phone's screen in place of its own keyboard, or dropped down
 * under the boxes on desktop. Keys act on click but never take focus, so
 * the Enochian box keeps its caret.
 */
export default function Keypad({
  docked,
  onLetter,
  onBackspace,
  onDone,
}: {
  docked: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}) {
  return (
    <Box
      sx={styles}
      className={docked ? "keypad-docked" : "keypad-dropdown"}
      role="group"
      aria-label={LABELS.keypad}
    >
      <div className="keypad-bar">
        <span>{LABELS.keypadHint}</span>
        <span className="keypad-actions">
          <button
            type="button"
            className="keypad-action"
            aria-label={LABELS.backspace}
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={onBackspace}
          >
            {LABELS.backspaceKey}
          </button>
          <button
            type="button"
            className="keypad-action"
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={onDone}
          >
            {LABELS.done}
          </button>
        </span>
      </div>
      <div className="keypad-grid">
        {KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            className="keypad-key"
            aria-label={`${key.name}, ${key.latin}`}
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={() => onLetter(key.id)}
          >
            <span className="keypad-glyph" style={EnochianFont.style}>
              {key.id}
            </span>
            <span className="keypad-latin">{key.latin}</span>
          </button>
        ))}
      </div>
    </Box>
  );
}
