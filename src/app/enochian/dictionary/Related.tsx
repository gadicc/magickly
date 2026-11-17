"use client";

import * as React from "react";
import { loadUses } from "./InTheKeys";
import { LABELS } from "./labels";
import {
  type RelatedItem,
  type RelatedTable,
  relatedIndex,
} from "./related/format";

/** Where the page fetches the related words (`related.json/route.ts`). */
export const RELATED_URL = "/enochian/dictionary/related.json";

let loading: Promise<ReadonlyMap<string, RelatedItem[]>> | undefined;

/**
 * The related words, fetched and indexed once per page load; a failure
 * may be retried. The page's address holds the reader's search, so the
 * request sends only the origin as its Referer.
 */
function loadRelated() {
  loading ??= fetch(RELATED_URL, { referrerPolicy: "origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`${RELATED_URL}: ${response.status}`);
      return response.json() as Promise<RelatedTable>;
    })
    .then(relatedIndex)
    .catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** Forgets the related words, so the next load fetches again (for tests). */
export function forgetRelated() {
  loading = undefined;
}

/**
 * "Related by meaning" (plan 081, S11, step 2G): up to three of our
 * glosses close in meaning to the entry's own, each with the forms that
 * open their entries, marked as a machine's suggestion. Nothing shows
 * until the table arrives, or if it fails or the entry has none. It
 * waits, too, until "In the Keys" above it has its uses (or has failed),
 * so that part never appears above it and pushes it down.
 */
export default function Related({
  word,
  onOpen,
}: {
  word: string;
  /** Opens another entry, as the list's rows do. */
  onOpen: (word: string) => void;
}) {
  const [items, setItems] = React.useState<readonly RelatedItem[] | null>(null);
  React.useEffect(() => {
    let live = true;
    setItems(null);
    Promise.allSettled([loadUses(), loadRelated()]).then(([, related]) => {
      // A failed load shows nothing: the entry is complete without them.
      if (live && related.status === "fulfilled")
        setItems(related.value.get(word) ?? []);
    });
    return () => {
      live = false;
    };
  }, [word]);
  if (!items?.length) return null;
  return (
    <>
      <h3>{LABELS.related}</h3>
      <ul className="entry-related">
        {items.map((item) => (
          <li key={item.gloss}>
            {item.forms.map((one, at) => (
              <React.Fragment key={one.entry}>
                {at > 0 && ", "}
                <button
                  type="button"
                  className="entry-related-form"
                  onClick={() => onOpen(one.entry)}
                >
                  {one.form}
                </button>
              </React.Fragment>
            ))}{" "}
            {LABELS.relatedGloss(item.gloss)}
          </li>
        ))}
      </ul>
      <div className="entry-note">{LABELS.relatedNote}</div>
    </>
  );
}
