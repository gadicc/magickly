"use client";

import * as React from "react";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { ReadingLine } from "../translate/lineParts";
import { loadTranslator } from "../translate/load";
import type { ToEnochian, Translator } from "../translate/lookup";
import { LABELS } from "./labels";
import PreviewShell from "./PreviewShell";

/**
 * The dictionary's "as a sentence" preview (plan 081, decisions 3 and
 * 19): the translator's reading of a query of three words or more, in one
 * line, with the same direction guess and the same code as its page.
 * `dictionary.tsx` loads this module lazily, and it loads the Keys table,
 * so a shorter query costs the dictionary nothing. While they load, the
 * frame holds a placeholder. If the Keys fail, nothing shows while the
 * query keeps three words or more; the dictionary unmounts this below
 * three, so a query that drops below and comes back tries again, rather
 * than every keystroke fetching and flashing.
 */
export default function SentencePreview({ query }: { query: string }) {
  const [translator, setTranslator] = React.useState<Translator | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    loadTranslator().then(
      (loaded) => {
        if (live) setTranslator(loaded);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const translation = React.useMemo(
    () => translator?.translate(query) ?? null,
    [translator, query],
  );
  if (failed) return null;
  if (!translation) return <PreviewShell query={query} />;
  // Shown from three words by `wordCount`, the count the guess reads both
  // ways only up to two: one reading. The guessed one, if ever both.
  const english = translation.guess.language === "english";
  const toEnochian = english ? translation.toEnochian : undefined;
  const toEnglish = english ? undefined : translation.toEnglish;
  if (!toEnochian?.tokens.length && !toEnglish?.tokens.length) return null;
  return (
    <PreviewShell query={query} direction={LABELS.previewDirection(english)}>
      {toEnochian ? (
        <FormsLine result={toEnochian} />
      ) : (
        toEnglish && <ReadingLine line={toEnglish.line} />
      )}
    </PreviewShell>
  );
}

/**
 * English into Enochian in one line: each form, and each gap as its
 * English in brackets, marked as having no form. The words a rule leaves
 * out are counted in the label, since the line has no tiles to show them.
 */
function FormsLine({ result }: { result: ToEnochian }) {
  const shown = result.tokens.filter((token) => token.kind !== "chip");
  return (
    <p className="tr-line">
      <span className="tr-line-label">
        {LABELS.previewForms(result.tokens.length - shown.length)}
        <span style={visuallyHidden}>{LABELS.previewLabelEnd}</span>
      </span>
      <span className="tr-line-text">
        {shown.map((token, at) => (
          <React.Fragment key={token.span.join("-")}>
            {at > 0 && " "}
            {token.kind === "form" ? (
              token.form
            ) : (
              <span className="tr-missing">
                {LABELS.previewGapOpen}
                {token.english}
                {LABELS.previewGapClose}
                <span style={visuallyHidden}>{` ${LABELS.previewNoForm}`}</span>
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    </p>
  );
}
