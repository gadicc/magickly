"use client";

import { Button, ButtonGroup } from "@mui/material";
import {
  RITUAL_EDITOR_LAYOUTS,
  type RitualEditorLayout,
} from "./useRitualEditorLayout";

/**
 * An editor's layout switch: Source, Split and Visual, in the order split
 * view lays the panels out, the chosen one pressed (`aria-pressed`) as
 * well as filled. The ritual editor, the new-ritual form and the
 * `/gd/halls/editor` editor all use it, so the three read alike.
 */
export function RitualLayoutSwitch({
  label,
  value,
  onChoose,
  isDisabled = () => false,
  withoutSplit = false,
}: {
  /** The group's accessible name, such as "Editor layout". */
  label: string;
  /** The layout shown. */
  value: RitualEditorLayout;
  onChoose(layout: RitualEditorLayout): void;
  /** Whether a layout's button is disabled. */
  isDisabled?: (layout: RitualEditorLayout) => boolean;
  /** Leaves Split out, for a screen too narrow for two panels. */
  withoutSplit?: boolean;
}) {
  return (
    <ButtonGroup size="small" aria-label={label}>
      {RITUAL_EDITOR_LAYOUTS.filter(
        ([layout]) => !withoutSplit || layout !== "split",
      ).map(([layout, name]) => (
        <Button
          key={layout}
          type="button"
          aria-pressed={value === layout}
          disabled={isDisabled(layout)}
          variant={value === layout ? "contained" : "outlined"}
          onClick={() => onChoose(layout)}
        >
          {name}
        </Button>
      ))}
    </ButtonGroup>
  );
}
