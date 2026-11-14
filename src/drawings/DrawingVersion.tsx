import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

/**
 * A version's note as magick-components exports them for the rose and the
 * candlestick (`ROSE_VERSION_NOTES`, `CANDLESTICK_VERSION_NOTES`).
 */
export interface DrawingVersionNote<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly text: string;
  readonly sources: readonly { readonly text: string; readonly url?: string }[];
}

/**
 * The menu of a drawing's versions, as the tablets' page offers theirs:
 * each by its note's title, the default marked.
 */
export function VersionSelect<Id extends string>({
  id,
  versions,
  notes,
  defaultVersion,
  value,
  onChange,
  size,
}: {
  /** The select's id; its label's is this with `-label`. */
  id: string;
  versions: readonly Id[];
  notes: Readonly<Record<Id, DrawingVersionNote<Id>>>;
  defaultVersion: Id;
  value: Id;
  onChange: (version: Id) => void;
  /** To match the fields beside it. */
  size?: "small" | "medium";
}) {
  return (
    <FormControl size={size}>
      <InputLabel id={`${id}-label`}>Version</InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        value={value}
        label="Version"
        onChange={(event) => onChange(event.target.value as Id)}
      >
        {versions.map((each) => (
          <MenuItem key={each} value={each}>
            {notes[each].title}
            {each === defaultVersion ? " (default)" : ""}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/**
 * The chosen version's note under the drawing, as the tablets' page shows
 * its versions': the title, where it comes from, and the works, each
 * linked to its scan.
 */
export function VersionNote({
  note,
  headingId,
}: {
  note: DrawingVersionNote;
  headingId: string;
}) {
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mt: 3 }}>
      <Typography variant="h5" component="h2" id={headingId}>
        {note.title}
      </Typography>
      <Typography variant="body1">{note.text}</Typography>
      <Typography component="ul" variant="body2" sx={{ pl: 3, mt: 0.5 }}>
        {note.sources.map((source) => (
          <li key={source.text}>
            {source.url ? (
              <a href={source.url} rel="noreferrer">
                {source.text}
              </a>
            ) : (
              source.text
            )}
          </li>
        ))}
      </Typography>
    </Box>
  );
}
