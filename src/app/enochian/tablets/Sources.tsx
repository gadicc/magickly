import { Typography } from "@mui/material";
import {
  sourceText,
  sourceUrl,
  type TabletSource,
  versionNote,
} from "magick-data/enochian/tabletNotes";
import type { TabletVersionId } from "magick-data/enochian/tablets";

/** A version's title, from its note. */
export const versionTitle = (version: TabletVersionId) =>
  versionNote(version)?.title ?? version;

/** The works cited, each linked to its scan where there is one. */
export function Sources({ sources }: { sources: readonly TabletSource[] }) {
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
