"use client";

import { hallTagSpec } from "@magick-components/gd/hall/spec";
import type {
  HallArtRegistry,
  HallAttrSpec,
  HallNode,
} from "@magick-components/gd/hall/types";
import {
  BOARD_KINDS,
  HALL_ROLES,
  LIGHT_KINDS,
  PLACEABLE_ATTRIBUTES,
} from "@magick-components/gd/hall/vocabulary";
import Add from "@mui/icons-material/Add";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Remove from "@mui/icons-material/Remove";
import {
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { registerPendingEdit } from "../pendingEdits";
import type { JsonValue } from "../semantic";
import styles from "./gdHallEditor.module.css";
import { type HallSelectable, type HallView, hallNodeName } from "./hallEdits";
import { round2 } from "./hallGeometry";
import { standOptions, standValue } from "./hallHosts";
import type { HallElement } from "./hallModel";
import { hallItemKinds, itemKindLabel } from "./hallPalette";
import { reorderable, rowHasPositions, rowPlace } from "./hallRows";

/**
 * Item attributes that only some kinds draw: shown for those kinds, or
 * when the node already has them. (The lamp's and the lantern's `light`
 * is their art's own attribute, so other items never have it.)
 */
const SOME_KINDS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["form", new Set(["cross"])],
  ["dir", new Set(["triangle", "pentagram"])],
  ["fill", new Set(["cross", "triangle", "pentagram"])],
  ["stroke", new Set(["cross", "triangle", "pentagram", "lightning"])],
]);

/**
 * Whether the panel offers a field for a node: an item's attributes for
 * the kinds that draw them, a board's `w` and `h` unless it shows a
 * diagram (which keeps the diagram's proportions and ignores them), and
 * any attribute the node already has, so it can be emptied.
 */
export function hallFieldShown(node: HallElement, name: string): boolean {
  if (Object.hasOwn(node.attrs, name)) return true;
  if (node.tag === "item") {
    const kinds = SOME_KINDS.get(name);
    return (
      kinds === undefined ||
      (typeof node.attrs.kind === "string" && kinds.has(node.attrs.kind))
    );
  }
  if (node.tag === "board" && (name === "w" || name === "h"))
    return !(BOARD_KINDS as readonly unknown[]).includes(node.attrs.kind);
  return true;
}

/**
 * A field's label for a node. A light's `fill` is the colour of its glass
 * from before `light`: the panel shows it only where a hall still has one
 * (`hallFieldShown`), named so the author knows to move it.
 */
export function hallFieldLabel(node: HallElement, name: string): string {
  const light =
    node.tag === "item" &&
    typeof node.attrs.kind === "string" &&
    LIGHT_KINDS.has(node.attrs.kind);
  return light && name === "fill"
    ? "Fill (old light colour)"
    : fieldLabel(name);
}

/**
 * Whether an element in the panel is one of its fields, whose focus the
 * panel keeps by staying open (not the button that shows the hall's).
 */
const isField = (element: Element) =>
  !element.closest("[data-hall-fields-toggle]");

/**
 * A callback ref that notes, in `lost`, an element removed while it held
 * the focus. React detaches a ref before it removes the element, so the
 * focus can still be read there; the browser then drops it to the page.
 */
function useFocusWatch(lost: { current: boolean }) {
  const element = useRef<HTMLElement | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      if (node) element.current = node;
      else {
        if (element.current && document.activeElement === element.current)
          lost.current = true;
        element.current = null;
      }
    },
    [lost],
  );
}

/** Fields shown first, in this order; the tag's own follow in spec order. */
const FIRST = ["x", "y", "at", "anchor", "scale", "label", "labelPos"];

/** Field names where the attribute's own name needs help. */
const FIELD_LABELS: ReadonlyMap<string, string> = new Map([
  ["x", "x (South)"],
  ["y", "y (West)"],
  ["at", "At (a point of its parent)"],
  ["dais", "Dais depth"],
  ["margin", "Margin, every side"],
  ["n", "Trump number"],
  ["w", "Width"],
  ["h", "Height"],
  ["pos", "Position"],
  ["labelPos", "Label position"],
  ["light", "Light colour"],
  ["reversed", "Reversed letters"],
  ["alt", "Second letters"],
]);

/** The fields of a node, in order: spec attributes with the common first. */
export function hallFieldOrder(
  attributes: ReadonlyMap<string, HallAttrSpec>,
): [string, HallAttrSpec][] {
  const entries = [...attributes];
  const rank = (name: string) => {
    const index = FIRST.indexOf(name);
    return index < 0 ? FIRST.length : index;
  };
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry[0]) - rank(b.entry[0]) || a.index - b.index)
    .map(({ entry }) => entry);
}

/** A node's attribute specs: its tag's, or a placeholder's placeable ones. */
export function hallNodeSpec(
  node: HallElement,
  art: HallArtRegistry,
): ReadonlyMap<string, HallAttrSpec> {
  const row = { type: node.tag, ...node.attrs } as HallNode;
  return hallTagSpec(node.tag, art, row)?.attributes ?? PLACEABLE_ATTRIBUTES;
}

/**
 * Checks a typed number against its spec: the value to write (rounded to
 * two decimals), `undefined` to remove the attribute, or an error.
 */
export function parseNumberField(
  text: string,
  spec: Extract<HallAttrSpec, { kind: "number" }>,
): { value: number | undefined } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: undefined };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return { error: "Not a number" };
  const value = round2(Number(trimmed));
  const { min, max } = spec;
  if ((min !== undefined && value < min) || (max !== undefined && value > max))
    return {
      error:
        min === undefined
          ? `At most ${max}`
          : max === undefined
            ? `At least ${min}`
            : `Between ${min} and ${max}`,
    };
  if (spec.integer && !Number.isInteger(value))
    return { error: "A whole number" };
  return { value };
}

interface FieldProps {
  name: string;
  /** What the field is called, when not its attribute's own name. */
  label?: string;
  spec: HallAttrSpec;
  value: JsonValue | undefined;
  /** Shown when the attribute is absent: where the node stands, or its default. */
  placeholder?: string;
  disabled: boolean;
  art: HallArtRegistry;
  /** Writes a value; false when the hall did not take it. */
  onCommit: (name: string, value: JsonValue | undefined) => boolean;
}

/** A field's label: `marginNorth` reads "Margin north", `labelSize` "Label size". */
export const fieldLabel = (name: string): string => {
  const known = FIELD_LABELS.get(name);
  if (known) return known;
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const commitOnEnter = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
};

/** A number or string typed and written when the field is left or Enter. */
function TypedField({
  name,
  label = fieldLabel(name),
  spec,
  value,
  placeholder,
  disabled,
  onCommit,
}: FieldProps) {
  const shown = value === undefined || value === null ? "" : String(value);
  const [text, setText] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // The node changed under the field (a drag, undo): show its value.
  useEffect(() => {
    setText(shown);
    setError(null);
  }, [shown]);
  /** Writes the typed value; true when the hall took a change. */
  const commit = (): boolean => {
    if (text === shown) return false;
    if (spec.kind === "number") {
      const parsed = parseNumberField(text, spec);
      if ("error" in parsed) {
        setError(parsed.error);
        return false;
      }
      return write(parsed.value);
    }
    return write(text === "" ? undefined : text);
  };
  /** A value the hall did not take goes back to the hall's, with a note. */
  const write = (next: JsonValue | undefined): boolean => {
    if (onCommit(name, next)) {
      setError(null);
      return true;
    }
    setText(shown);
    setError("Not written");
    return false;
  };
  // A save writes what is still being typed (Ctrl+S does not leave the
  // field), unless the field is disabled.
  const flush = useRef(commit);
  flush.current = disabled ? () => false : commit;
  useEffect(() => registerPendingEdit(() => flush.current()), []);
  // A lock (a save, a source sync) disables the field without a blur in
  // Chromium, and takes the focus away: the typed value is kept while
  // locked, then written, as leaving the field would have.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on unlocking only
  useEffect(() => {
    if (!disabled && document.activeElement !== input.current) commit();
  }, [disabled]);
  return (
    <TextField
      size="small"
      label={label}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      error={!!error}
      helperText={error ?? undefined}
      onChange={(event) => setText(event.target.value)}
      inputRef={input}
      onBlur={commit}
      onKeyDown={commitOnEnter}
      slotProps={{
        inputLabel: placeholder ? { shrink: true } : undefined,
        htmlInput: {
          inputMode: spec.kind === "number" ? "decimal" : undefined,
          maxLength: spec.kind === "string" ? spec.maxLength : undefined,
          "data-hall-field": name,
        },
      }}
    />
  );
}

/** A choice: an enum, an officer's role or an item's kind. */
function ChoiceField({
  name,
  label = fieldLabel(name),
  value,
  options,
  disabled,
  onCommit,
}: Omit<FieldProps, "spec" | "art"> & {
  options: readonly (readonly [string, string])[];
}) {
  const current = typeof value === "string" ? value : "";
  // A value the list does not know (an unknown role) stays choosable.
  const all =
    current === "" || options.some(([option]) => option === current)
      ? options
      : [...options, [current, current] as const];
  return (
    <TextField
      select
      size="small"
      label={label}
      value={current}
      disabled={disabled}
      onChange={(event) =>
        onCommit(
          name,
          event.target.value === "" ? undefined : event.target.value,
        )
      }
      slotProps={{ htmlInput: { "data-hall-field": name } }}
    >
      <MenuItem value="">
        <em>Default</em>
      </MenuItem>
      {all.map(([option, label]) => (
        <MenuItem key={option} value={option}>
          {label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function Field(props: FieldProps) {
  const { name, spec, value, disabled, onCommit, art } = props;
  const label = props.label ?? fieldLabel(name);
  if (name === "role")
    return <ChoiceField {...props} options={[...HALL_ROLES]} />;
  if (name === "kind" && spec.kind === "string")
    return (
      <ChoiceField
        {...props}
        options={hallItemKinds(art).map(
          (kind) => [kind, itemKindLabel(kind)] as const,
        )}
      />
    );
  if (spec.kind === "enum")
    return (
      <ChoiceField
        {...props}
        // `center` is `centre`'s other spelling: offer one.
        options={spec.values
          .filter((option) => option !== "center")
          .map(
            (option) =>
              [
                option,
                spec.labels?.[option]
                  ? `${option} · ${spec.labels[option]}`
                  : option,
              ] as const,
          )}
      />
    );
  if (spec.kind === "boolean") {
    const checked =
      value === true ||
      value === "true" ||
      (value === undefined && spec.default === true);
    return (
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={checked}
            disabled={disabled}
            // Switched to its default, the attribute goes, as an emptied
            // field's does.
            onChange={(event) =>
              onCommit(
                name,
                event.target.checked === (spec.default === true)
                  ? undefined
                  : event.target.checked,
              )
            }
            slotProps={{ input: { "data-hall-field": name } as object }}
          />
        }
        label={label}
      />
    );
  }
  return <TypedField {...props} />;
}

/** Props of the properties panel. */
export interface HallPropertiesProps {
  view: HallView;
  selected: HallSelectable | undefined;
  art: HallArtRegistry;
  disabled: boolean;
  /** Each returns false when the hall did not take the value. */
  onSetAttr: (
    id: string,
    name: string,
    value: JsonValue | undefined,
  ) => boolean;
  onSetCaption: (text: string | undefined) => boolean;
  onScaleStep: (entry: HallSelectable, up: boolean) => void;
  onDuplicate: (entry: HallSelectable) => void;
  onDelete: (entry: HallSelectable) => void;
  /** Moves a row child one place earlier (-1) or later (1) in its row. */
  onStepInRow: (entry: HallSelectable, step: -1 | 1) => void;
  /** Takes every position along the row away ("Spread evenly again"). */
  onSpreadRow: (entry: HallSelectable) => void;
  /** Stands an object on the floor (`floor`) or on a host (its ID). */
  onStandOn: (entry: HallSelectable, value: string) => void;
  /**
   * Docked at the foot of the screen, as a strip with its fields in
   * columns that can be hidden to its title bar, rather than beside the
   * drawing.
   */
  docked?: boolean;
  /** Whether the docked panel shows only its title bar. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Takes the focus when the docked panel's Hide button, holding it, goes
   * as the panel moves beside the drawing and the panel has no field to
   * take it (the drawing, as the editor passes it).
   */
  onFocusElsewhere?: () => void;
}

/**
 * The properties of the selected object, or of the hall when nothing is
 * selected: fields generated from the hall vocabulary (`hallTagSpec`, the
 * art's own attributes included). Enums are selects, numbers and strings
 * are typed and written when the field is left or Enter is pressed (one
 * change each), booleans are switches. An empty field removes the
 * attribute, so the default applies.
 */
export function HallProperties({
  view,
  selected,
  art,
  disabled,
  onSetAttr,
  onSetCaption,
  onScaleStep,
  onDuplicate,
  onDelete,
  onStepInRow,
  onSpreadRow,
  onStandOn,
  docked = false,
  collapsed = false,
  onCollapsedChange,
  onFocusElsewhere,
}: HallPropertiesProps) {
  const headingId = useId();
  const bodyId = useId();
  const body = useRef<HTMLDivElement>(null);
  /** Whether a field in the panel holds the focus. */
  const [focusInside, setFocusInside] = useState(false);
  /**
   * Kept open in this editor although the viewer hides the dock: it docked
   * while a field held the focus, which hiding would have dropped.
   */
  const [heldOpen, setHeldOpen] = useState(false);
  /** Docked with nothing selected: the hall's other fields on request. */
  const [hallFieldsShown, setHallFieldsShown] = useState(false);
  const hidden = docked && collapsed && !heldOpen && !focusInside;
  const compact = docked && !selected && !hallFieldsShown && !focusInside;
  useEffect(() => {
    if (docked && collapsed && focusInside) setHeldOpen(true);
    // Beside the drawing it is never hidden; docked again, it follows the
    // viewer's choice.
    if (!docked) setHeldOpen(false);
  }, [docked, collapsed, focusInside]);
  // Blur alone cannot be trusted to say the focus left: Firefox fires none
  // for a focused field that is removed. Read it again after each render.
  useLayoutEffect(() => {
    const active = document.activeElement;
    const inside =
      !!active && !!body.current?.contains(active) && isField(active);
    if (inside !== focusInside) setFocusInside(inside);
  });
  /**
   * A button of the dock's that held the focus as the dock went (Hide, and
   * All hall settings): the focus is then given to a field.
   */
  const dockFocusLost = useRef(false);
  const toggleRef = useFocusWatch(dockFocusLost);
  const hallFieldsRef = useFocusWatch(dockFocusLost);
  useLayoutEffect(() => {
    if (!dockFocusLost.current) return;
    dockFocusLost.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const field = body.current?.querySelector<HTMLElement>(
      "input:not([disabled]):not([type=hidden]), button:not([disabled])",
    );
    if (field) field.focus({ preventScroll: true });
    else onFocusElsewhere?.();
  });
  const node = selected?.node ?? view.hall;
  const spec = hallNodeSpec(node, art);
  const fields = hallFieldOrder(spec).filter(([name]) =>
    hallFieldShown(node, name),
  );
  const unknown = Object.keys(node.attrs).filter((name) => !spec.has(name));
  const object = selected?.object;
  const placeholder = (name: string): string | undefined => {
    if (!object) return undefined;
    if (name === "x" || name === "y")
      return String(round2(object.position[name]));
    if (name === "scale") return String(round2(object.scale));
    return undefined;
  };
  const caption = view.hall.children?.find(
    (child): child is HallElement =>
      child.kind === "element" && child.tag === "caption",
  );
  const commit = (name: string, value: JsonValue | undefined) =>
    onSetAttr(node.id, name, value);
  const row = selected ? rowPlace(view, selected.id) : undefined;
  const inSpread = !!selected && reorderable(view, selected.id);
  const order = row?.spread.findIndex((entry) => entry.id === selected?.id);
  const stands = selected ? standOptions(view, selected.id) : [];
  const standing = selected ? standValue(view, selected.id) : undefined;
  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      data-hall-panel={docked ? "docked" : "beside"}
      data-collapsed={hidden || undefined}
    >
      <div className={styles.panelTitleBar}>
        <h3 id={headingId} className={styles.panelHeading}>
          {selected ? hallNodeName(node) : "Hall"}{" "}
          <span className={styles.panelTag}>
            · {selected ? node.tag : "nothing selected"}
          </span>
        </h3>
        {docked && (
          <Button
            size="small"
            className={styles.dockToggle}
            aria-expanded={!hidden}
            aria-controls={bodyId}
            endIcon={hidden ? <ExpandLess /> : <ExpandMore />}
            ref={toggleRef}
            onClick={() => {
              if (hidden) onCollapsedChange?.(false);
              else {
                setHeldOpen(false);
                onCollapsedChange?.(true);
              }
            }}
          >
            {hidden ? "Show" : "Hide"}
            <span className={styles.visuallyHidden}> properties</span>
          </Button>
        )}
      </div>
      {/* Hidden rather than removed, so a field keeps what is typed in it. */}
      <div
        ref={body}
        id={bodyId}
        className={styles.panelBody}
        hidden={hidden}
        onFocus={(event) => setFocusInside(isField(event.target))}
        onBlur={(event) => {
          const next = event.relatedTarget as Element | null;
          if (!next || !event.currentTarget.contains(next) || !isField(next))
            setFocusInside(false);
        }}
      >
        {!selected && (
          <TypedField
            key={`caption-${view.hall.id}`}
            name="caption"
            spec={{ kind: "string", maxLength: 200 }}
            value={
              typeof caption?.attrs.text === "string"
                ? caption.attrs.text
                : undefined
            }
            disabled={disabled}
            art={art}
            onCommit={(_name, value) =>
              onSetCaption(typeof value === "string" ? value : undefined)
            }
          />
        )}
        {docked && !selected && (
          // Docked, the hall's own fields would cover the drawing as it
          // opens: the caption is shown, the rest a click away.
          <Button
            size="small"
            variant="text"
            className={styles.hallFieldsToggle}
            data-hall-fields-toggle
            ref={hallFieldsRef}
            aria-expanded={!compact}
            onClick={() => setHallFieldsShown(compact)}
          >
            {compact ? "All hall settings" : "Fewer hall settings"}
          </Button>
        )}
        {!compact &&
          fields.map(([name, fieldSpec], index) => {
            const field = (
              key: string,
              fieldName: string,
              spec: HallAttrSpec,
            ) => (
              <Field
                key={key}
                name={fieldName}
                label={hallFieldLabel(node, fieldName)}
                spec={spec}
                value={node.attrs[fieldName]}
                placeholder={placeholder(fieldName)}
                disabled={disabled}
                art={art}
                onCommit={commit}
              />
            );
            // x and y side by side, and y with them.
            const next = fields[index + 1];
            if (name === "y" && fields[index - 1]?.[0] === "x") return null;
            if (name === "x" && next?.[0] === "y")
              return (
                <div key={`${node.id}-xy`} className={styles.fieldPair}>
                  {field(`${node.id}-x`, "x", fieldSpec)}
                  {field(`${node.id}-y`, "y", next[1])}
                </div>
              );
            if (name !== "scale" || !selected)
              return field(`${node.id}-${name}`, name, fieldSpec);
            return (
              <div key={`${node.id}-scale`} className={styles.scaleRow}>
                {field(`${node.id}-${name}`, name, fieldSpec)}
                <IconButton
                  size="small"
                  aria-label="Smaller"
                  disabled={disabled}
                  onClick={() => onScaleStep(selected, false)}
                >
                  <Remove fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Larger"
                  disabled={disabled}
                  onClick={() => onScaleStep(selected, true)}
                >
                  <Add fontSize="small" />
                </IconButton>
              </div>
            );
          })}
        {selected && stands.length > 1 && (
          <TextField
            select
            size="small"
            label="Stands on"
            value={standing ?? ""}
            disabled={disabled}
            onChange={(event) => onStandOn(selected, event.target.value)}
            slotProps={{ htmlInput: { "data-hall-field": "standsOn" } }}
          >
            {stands.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        {selected &&
          row &&
          (inSpread || rowHasPositions(view, selected.id)) && (
            <div
              className={styles.rowActions}
              role="group"
              aria-label={`Place in the ${row.row.tag === "dais" ? "dais" : "banner row"}`}
            >
              {inSpread && order !== undefined && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={disabled || order <= 0}
                    onClick={() => onStepInRow(selected, -1)}
                  >
                    {row.along === "x" ? "Move left" : "Move up"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={disabled || order >= row.spread.length - 1}
                    onClick={() => onStepInRow(selected, 1)}
                  >
                    {row.along === "x" ? "Move right" : "Move down"}
                  </Button>
                </>
              )}
              {rowHasPositions(view, selected.id) && (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={disabled}
                  onClick={() => onSpreadRow(selected)}
                >
                  Spread evenly again
                </Button>
              )}
            </div>
          )}
        {!compact && unknown.length > 0 && (
          <p className={styles.panelNote}>
            Other attributes, edited in the source: {unknown.join(", ")}
          </p>
        )}
        {selected && (
          <div className={styles.panelActions}>
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => onDuplicate(selected)}
            >
              Duplicate
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={disabled}
              onClick={() => onDelete(selected)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
