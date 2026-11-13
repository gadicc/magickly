"use client";

import { Button } from "@mui/material";
import * as React from "react";
import Link from "@/ui/Link";
import type { KeyUse } from "./keyUses";
import { LABELS } from "./labels";

/** Where the page fetches the map of uses (`keys.json/route.ts`). */
export const USES_URL = "/enochian/dictionary/keys.json";

let loading: Promise<Record<string, KeyUse[]>> | undefined;

/** The map of uses, fetched once per page load; a failure may be retried. */
function loadUses() {
  loading ??= fetch(USES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`${USES_URL}: ${response.status}`);
      return response.json() as Promise<Record<string, KeyUse[]>>;
    })
    .catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** The Keys page's anchor for a use: the Key (or Aethyr) and the word. */
export function keysLink(use: KeyUse) {
  const place =
    use.aethyr === undefined ? `key-${use.key}` : `aethyr-${use.aethyr}`;
  return `/enochian/keys#${place}-word-${use.row}`;
}

/**
 * "In the Keys": where Dee's Keys say the word, the first use with "and N
 * more" (plan 074, decision 9). Nothing shows until the map arrives, or if
 * it fails or the Keys never say the word.
 */
export default function InTheKeys({ word }: { word: string }) {
  const [uses, setUses] = React.useState<KeyUse[] | null>(null);
  const [all, setAll] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    setUses(null);
    setAll(false);
    loadUses()
      .then((map) => {
        if (live) setUses(map[word] ?? []);
      })
      .catch(() => {
        // The entry is complete without it.
      });
    return () => {
      live = false;
    };
  }, [word]);
  if (!uses?.length) return null;
  const shown = all ? uses : uses.slice(0, 1);
  return (
    <>
      <h3>{LABELS.inTheKeys}</h3>
      <ul className="entry-uses">
        {shown.map((use) => (
          <li key={`${use.key}-${use.aethyr}-${use.row}`}>
            <Link href={keysLink(use)}>{LABELS.place(use)}</Link>
            {use.part && (
              <span className="entry-source">{LABELS.inPart(use.part)}</span>
            )}
            <div className="entry-quote">
              {LABELS.quoteOpen(use.before)}
              <b>{use.english}</b>
              {LABELS.quoteClose(use.after)}
            </div>
          </li>
        ))}
      </ul>
      {!all && uses.length > 1 && (
        <Button size="small" onClick={() => setAll(true)}>
          {LABELS.moreUses(uses.length - 1)}
        </Button>
      )}
    </>
  );
}
