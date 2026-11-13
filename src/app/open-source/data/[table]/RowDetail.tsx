"use client";
import { Box, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { type defaultStyles, JsonView } from "react-json-view-lite";
import Link from "@/ui/Link";
import styles from "./jsonView.module.css";

/** The viewer's classes, coloured from the theme's variables. */
const JSON_STYLE: typeof defaultStyles = {
  container: styles.container,
  basicChildStyle: styles.child,
  childFieldsContainer: styles.children,
  label: styles.label,
  clickableLabel: styles.clickable,
  nullValue: styles.null,
  undefinedValue: styles.null,
  stringValue: styles.string,
  booleanValue: styles.boolean,
  numberValue: styles.number,
  otherValue: styles.other,
  punctuation: styles.punctuation,
  collapseIcon: styles.collapse,
  expandIcon: styles.expand,
  collapsedContent: styles.collapsed,
  noQuotesForStringValues: false,
  quotesForFieldNames: true,
  stringifyStringValues: false,
  ariaLables: { collapseJson: "Collapse", expandJson: "Expand" },
};

/** The two levels a row's fields are at, open; anything deeper, folded. */
const shallow = (level: number) => level < 2;

/**
 * A row's detail (plan 080, decision 4): its JSON as written, and ways to
 * take it away: a copy, a link to the row, and its page where it has one.
 */
/** How long "Copied" stays before the button reads "Copy JSON" again. */
export const COPIED_FOR = 3000;

export default function RowDetail({
  rowKey,
  json,
  entity,
}: {
  rowKey: string;
  json: unknown;
  entity?: string;
}) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  useEffect(() => {
    if (copied !== "yes") return;
    const reset = setTimeout(() => setCopied(null), COPIED_FOR);
    return () => clearTimeout(reset);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        <Button size="small" variant="outlined" onClick={copy}>
          {copied === "yes" ? "Copied" : "Copy JSON"}
        </Button>
        <Button size="small" variant="outlined" href={`#${rowKey}`}>
          Link to row
        </Button>
        {entity ? (
          <Button
            size="small"
            variant="outlined"
            component={Link}
            href={entity}
          >
            Its page
          </Button>
        ) : null}
        {/* Always there, so that a screen reader announces what is put in it. */}
        <Box component="span" role="status" sx={{ alignSelf: "center" }}>
          {copied === "no" ? "The browser refused the clipboard." : ""}
        </Box>
      </Box>
      <JsonView
        data={json as object}
        style={JSON_STYLE}
        shouldExpandNode={shallow}
      />
    </>
  );
}
