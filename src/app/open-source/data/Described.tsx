import { Box } from "@mui/material";

/** Code spans, and runs of Hebrew letters (with the spaces between them). */
const PARTS = /(`[^`]+`|[\u0590-\u05ff](?:[\u0590-\u05ff\s]*[\u0590-\u05ff])?)/;

/**
 * A description from the field manifest. Names from the data are marked
 * as `code`, as Markdown marks them, and are set as code here; Hebrew that
 * stands alone, such as a letter, is set in Frank Ruhl Libre (plan 079).
 */
export default function Described({ text }: { text?: string }) {
  if (!text) return null;
  return text.split(PARTS).map((part, i) => {
    if (part.length > 1 && part.startsWith("`") && part.endsWith("`"))
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed
      return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^[\u0590-\u05ff]/.test(part))
      return (
        <Box
          component="span"
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed
          key={i}
          lang="he"
          dir="rtl"
          sx={{
            fontFamily: '"Frank Ruhl Libre", "Noto Sans Hebrew", serif',
            fontSize: "1.15em",
          }}
        >
          {part}
        </Box>
      );
    return part;
  });
}

/** A description as plain text, for a meta description: no code marks. */
export function plainText(text: string) {
  return text.replace(/`([^`]+)`/g, "$1");
}
