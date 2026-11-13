"use client";
import ContentCopy from "@mui/icons-material/ContentCopy";
import RestartAlt from "@mui/icons-material/RestartAlt";
import {
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Component, Fragment, type ReactNode, Suspense, useState } from "react";
import { type InkDrawing, inkClass } from "@/drawings/Ink";
import { plateClass } from "@/drawings/plate";
import Link from "@/ui/Link";
import type { ComponentName } from "./components";
import {
  type ExplorerProps,
  fieldText,
  jsxFor,
  parseValue,
  placeholders,
  switchValue,
  withProp,
} from "./controls";
import styles from "./explorer.module.css";
import { componentImage } from "./images";
import { LIVE } from "./live";
import type { PropDoc } from "./props";

/** One example as the page passes it: its title, props and fixed image. */
export interface ExplorerExample {
  title: string;
  props: ExplorerProps;
  /** The image of this example where the props cannot say (`GdHall`'s halls). */
  image?: string;
}

/** Shows a drawing's error in its place, and tries again on new props. */
class DrawingBoundary extends Component<
  { children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <Typography role="alert" color="error" sx={{ p: 2 }}>
          These props do not draw: {this.state.error.message}
        </Typography>
      );
    return this.props.children;
  }
}

/** One prop's control, from its type alone (plan 080, decision 5). */
function Control({
  prop,
  value,
  onChange,
}: {
  prop: PropDoc;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const control = prop.control;
  if (!control) return null;
  const set = value !== undefined;
  const clear = set && !prop.required && (
    <Tooltip title={`Unset ${prop.name}`}>
      <IconButton
        size="small"
        aria-label={`Unset ${prop.name}`}
        onClick={() => onChange(undefined)}
      >
        <RestartAlt fontSize="small" />
      </IconButton>
    </Tooltip>
  );
  const placeholder = set ? undefined : prop.default;
  if (control.kind === "switch")
    return (
      <div className={styles.control}>
        <FormControlLabel
          control={
            <Switch
              checked={switchValue(prop, value)}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
          label={<code>{prop.name}</code>}
        />
        {clear}
      </div>
    );
  if (control.kind === "choice")
    return (
      <div className={styles.control}>
        <FormControl size="small" fullWidth>
          <InputLabel id={`prop-${prop.name}`} shrink>
            {prop.name}
          </InputLabel>
          <Select
            labelId={`prop-${prop.name}`}
            label={prop.name}
            notched
            displayEmpty
            value={typeof value === "string" ? value : ""}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? undefined : event.target.value,
              )
            }
          >
            {prop.required ? null : (
              <MenuItem value="">
                <em>not set{prop.default ? ` (${prop.default})` : ""}</em>
              </MenuItem>
            )}
            {control.options.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {clear}
      </div>
    );
  return (
    <div className={styles.control}>
      <TextField
        size="small"
        fullWidth
        label={prop.name}
        type={control.kind === "number" ? "number" : "text"}
        value={fieldText(value)}
        placeholder={placeholder}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(event) => {
          const text = event.target.value;
          if (control.kind === "number")
            onChange(text === "" ? undefined : Number(text));
          else if (control.kind === "parsed")
            onChange(text === "" ? undefined : parseValue(text, prop.type));
          else onChange(text);
        }}
      />
      {clear}
    </div>
  );
}

/** Copies `text`, and says so for a moment. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="small"
      startIcon={<ContentCopy fontSize="small" />}
      aria-label={label}
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * The explorer (plan 080, decision 5): the component drawn live, its
 * examples and a control for each prop whose type allows one, the JSX for
 * what is drawn and, where the image route draws it too, a link to that
 * image. App code (AGPL); the examples are the package's (MIT).
 */
export default function Explorer({
  name,
  examples,
  props: docs,
  dark,
  examplesUrl,
}: {
  name: ComponentName;
  examples: readonly ExplorerExample[];
  props: readonly PropDoc[];
  dark?: InkDrawing | "plate";
  /** The example module on GitHub, for data too long to show as JSX. */
  examplesUrl: string;
}) {
  const [chosen, setChosen] = useState(0);
  const example = examples[chosen];
  const [props, setProps] = useState<ExplorerProps>(example.props);
  const Live = LIVE[name];
  const controlled = docs.filter((prop) => prop.control);
  const jsx = jsxFor(name, props);
  const elided = placeholders(props);
  const image = example.image ?? componentImage(name, props);
  const darkClass =
    dark === undefined ? "" : dark === "plate" ? plateClass : inkClass(dark);

  return (
    <div className={styles.explorer}>
      <div className={styles.stage}>
        <div className={`${styles.drawing} ${darkClass}`}>
          <DrawingBoundary key={JSON.stringify(props)}>
            {/* The page streams the drawing once its chunk has loaded. */}
            <Suspense fallback={null}>
              <Live {...props} />
            </Suspense>
          </DrawingBoundary>
        </div>
      </div>
      <div className={styles.panel}>
        {examples.length > 1 ? (
          <FormControl size="small" fullWidth sx={{ mb: 2 }}>
            <InputLabel id="explorer-example">Example</InputLabel>
            <Select
              labelId="explorer-example"
              label="Example"
              value={chosen}
              onChange={(event) => {
                const index = Number(event.target.value);
                setChosen(index);
                setProps(examples[index].props);
              }}
            >
              {examples.map((item, index) => (
                <MenuItem key={item.title} value={index}>
                  {item.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Example: {example.title}
          </Typography>
        )}
        {controlled.length ? (
          <fieldset className={styles.controls}>
            <legend>Props</legend>
            {controlled.map((prop) => (
              <Control
                key={prop.name}
                prop={prop}
                value={props[prop.name]}
                onChange={(value) =>
                  setProps((current) => withProp(current, prop.name, value))
                }
              />
            ))}
          </fieldset>
        ) : null}
        <Button
          size="small"
          startIcon={<RestartAlt fontSize="small" />}
          onClick={() => setProps(example.props)}
          sx={{ mt: 1 }}
        >
          Back to the example
        </Button>
      </div>
      <div className={styles.code}>
        <div className={styles.codeHead}>
          <Typography variant="subtitle2" component="h2" id="explorer-jsx">
            JSX
          </Typography>
          <CopyButton text={jsx} label={`Copy the JSX for ${name}`} />
        </div>
        <pre aria-labelledby="explorer-jsx" className={styles.pre}>
          <code>{jsx}</code>
        </pre>
        {elided.length ? (
          <Typography variant="body2" color="textSecondary">
            {elided.map((prop, index) => (
              <Fragment key={prop}>
                {index ? " and " : ""}
                <code>{prop}</code>
              </Fragment>
            ))}{" "}
            {elided.length > 1 ? "are" : "is"} the example&apos;s own data, too
            long to show here: see{" "}
            <Link href={examplesUrl}>the example module</Link>.
          </Typography>
        ) : null}
        {image ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            The site also serves this drawing as an image:{" "}
            <Link href={image}>SVG</Link>.
          </Typography>
        ) : null}
      </div>
    </div>
  );
}
