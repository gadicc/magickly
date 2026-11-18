"use client";

import { Box } from "@mui/material";
import * as React from "react";
import { USER_DAILY_CHAT_LIMIT } from "@/app/chat/limits";
import { useSession } from "@/auth/client";
import { DARK_SELECTOR } from "@/colorScheme";
import { visuallyHidden } from "@/ui/visuallyHidden";
import { LABELS } from "./labels";
import { TRANSLATOR_LIMITATIONS } from "./limitations";
import type { Translator } from "./lookup";
import type {
  CheckedReading,
  CheckedWord,
  ReadingSource,
} from "./reading/check";
import { CLIENT_DAILY_UNITS, READING_DEADLINE_MS } from "./reading/limits";
import {
  type Admitted,
  admitReading,
  readingParts,
  readingUnits,
} from "./reading/passage";
import type { ReadingEvent, ReadingRefusal } from "./reading/respond";
import type { PartFailure } from "./reading/store";
import { requestReading } from "./readingRequest";

/**
 * The AI reading of Enochian into English (plan 081, S2 and S7; step 2E):
 * a "Read with AI" button under the reading line, offered only when the
 * route would take the text (the same admission, `admitReading`), and,
 * once asked, the card in its place: the model's sentence, unchecked and
 * labelled so; each word in its checked state; where the text went and
 * what it used; and the AI reading's limitations. The text goes to the
 * route in the request's body, never the URL.
 */

const L = LABELS.reading;

type PartEvent = Extract<ReadingEvent, { type: "part" }>;
type ReadEvent = Extract<PartEvent, { status: "read" }>;
type DoneEvent = Extract<ReadingEvent, { type: "done" }>;

/** One request's progress, as its lines land. */
interface Run {
  status: "loading" | "finished" | "refused" | "lost";
  /** Each part's line, by its number less one; none yet for a part to come. */
  parts: readonly (PartEvent | undefined)[];
  done?: DoneEvent;
  refusal?: ReadingRefusal;
  /** Whether it was "Read again", which a refusal's retry repeats. */
  again: boolean;
  /**
   * The parts shown are the reading "Read again" would replace, kept until
   * the new one's first part lands, and kept for good when it is refused
   * or lost before then.
   */
  replacing?: boolean;
  /** Whether a line of this request's parts showed its text was sent. */
  arrived?: boolean;
}

/**
 * Failures worth sending again: the model's. Not the provider refusing
 * (likely to refuse again, at a cost), the switch, or a part the gateway
 * didn't route as asked (resending repeats that) and the part not sent
 * after it.
 */
const RETRIED: ReadonlySet<PartFailure> = new Set([
  "truncated",
  "unreadable",
  "timeout",
  "failed",
  "unavailable",
]);

/**
 * Failures after which no retry is offered, whatever else failed: the
 * gateway's routing (resending repeats it) and the provider refusing
 * (likely to refuse again, at a cost). A part not sent after another's
 * failure is retried with it.
 */
const NOT_RETRIED: ReadonlySet<PartFailure> = new Set(["routing", "refused"]);

/**
 * Failures that mean a model call was made, so the text was sent: not the
 * parts the route never sent ("not read", "off", "unavailable").
 */
const CALLED: ReadonlySet<PartFailure> = new Set([
  "truncated",
  "unreadable",
  "routing",
  "refused",
  "timeout",
  "failed",
]);

/** Whether a part's line shows that its text went to the model. */
const sentToModel = (event: PartEvent) =>
  event.status === "read" ? event.from === "model" : CALLED.has(event.state);

/** A label for text from the server, only when it is the label's own key. */
function own<T>(labels: Readonly<Record<string, T>>, key: string) {
  return Object.hasOwn(labels, key) ? labels[key] : undefined;
}

const isRead = (part: PartEvent | undefined): part is ReadEvent =>
  part?.status === "read";

/** A reset time, in the reader's own clock. */
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

const styles = {
  "& .ai-offer": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "4px 10px",
    margin: "0 0 14px",
  },
  "& .ai-button": {
    font: "inherit",
    fontSize: 14,
    fontWeight: 500,
    color: "primary.main",
    bgcolor: "transparent",
    border: 1,
    borderColor: "primary.main",
    borderRadius: 1,
    padding: "6px 14px",
    cursor: "pointer",
    "&:hover": { bgcolor: "action.hover" },
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "primary.main",
      outlineOffset: "2px",
    },
  },
  "& .ai-uses": { fontSize: 13, color: "text.secondary" },
  "& .ai-card": {
    border: 1,
    borderColor: "divider",
    borderLeft: 4,
    borderLeftColor: "primary.main",
    borderRadius: 1,
    bgcolor: "action.hover",
    padding: "10px 14px 12px",
    margin: "0 0 16px",
    "& h3": { mt: 0, outline: "none" },
  },
  "& .ai-who": { fontSize: 12, color: "text.secondary", mb: 1 },
  "& .ai-label": { display: "block", fontSize: 12, color: "text.secondary" },
  "& .ai-sentence": {
    fontSize: 18,
    lineHeight: 1.5,
    margin: "0 0 10px",
    overflowWrap: "anywhere",
  },
  "& .ai-note": { fontSize: 14, margin: "0 0 10px", overflowWrap: "anywhere" },
  "& .ai-words": {
    listStyle: "none",
    margin: "4px 0 10px",
    padding: 0,
    fontSize: 14,
    lineHeight: 1.55,
    "& li": {
      padding: "3px 0",
      borderTop: "1px dashed",
      borderColor: "divider",
      overflowWrap: "anywhere",
    },
  },
  "& .ai-word": { fontWeight: 500, letterSpacing: "0.02em" },
  "& .ai-state": {
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 0.5,
    padding: "0 4px",
    whiteSpace: "nowrap",
  },
  // Told apart by their words; the colours only help. Each is at least
  // 4.5:1 on the card in both schemes (plan 081, "2E build notes").
  "& .ai-confirmed": {
    color: "success.dark",
    [DARK_SELECTOR]: { color: "success.light" },
  },
  "& .ai-unconfirmed": { color: "text.secondary", border: "1px dotted" },
  "& .ai-guess": {
    color: "text.primary",
    border: "1px solid",
    borderColor: "warning.main",
    bgcolor: "rgba(var(--mui-palette-warning-mainChannel) / 0.14)",
    [DARK_SELECTOR]: { color: "warning.light" },
  },
  "& .ai-none": { color: "text.secondary", fontStyle: "italic" },
  "& .ai-source, & .ai-sep": { color: "text.secondary" },
  "& .ai-failed": { fontStyle: "italic" },
  "& .ai-status": { fontSize: 14, margin: "6px 0", overflowWrap: "anywhere" },
  "& .ai-foot": {
    fontSize: 12.5,
    color: "text.secondary",
    margin: "8px 0",
    overflowWrap: "anywhere",
  },
  "& .ai-limits": {
    margin: "4px 0 0",
    paddingLeft: "20px",
    fontSize: 13,
    color: "text.secondary",
    "& li": { margin: "2px 0" },
  },
  "& h4": {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "text.secondary",
    margin: "12px 0 2px",
  },
} as const;

/** A source as our data names it (S6). */
const sourceText = (source: ReadingSource) =>
  source.kind === "headword"
    ? L.headword(source.headword)
    : L.row(source.key, source.row, source.word, source.aethyr);

/** One word of the passage in its checked state, with the model's English. */
function WordRow({ word }: { word: CheckedWord }) {
  const english =
    word.english && (word.cut ? `${word.english}…` : word.english);
  return (
    <li>
      <span className="ai-word">{word.word}</span>
      {english && ` ${english}`}{" "}
      <span className={`ai-state ai-${word.state}`}>
        {own<string>(L.state, word.state)}
      </span>
      {word.sources.length > 0 && (
        <>
          <span className="ai-sep" aria-hidden>
            {" · "}
          </span>
          <span style={visuallyHidden}>, </span>
          <span className="ai-source">
            {word.sources.map(sourceText).join("; ")}
          </span>
        </>
      )}
    </li>
  );
}

/** The parts' sentences, shown as plain text or withheld with why (S7). */
function Sentences({ parts }: { parts: readonly (PartEvent | undefined)[] }) {
  const read = parts.flatMap((part) => (isRead(part) ? [part] : []));
  if (!read.length) return null;
  const shown = read.flatMap(({ reading }) =>
    reading.sentence.shown ? [reading.sentence.text] : [],
  );
  return (
    <>
      {shown.length > 0 && (
        <p className="ai-sentence">
          <span className="ai-label">{L.sentenceLabel}</span>
          {shown.join(" ")}
        </p>
      )}
      {read.map(({ part, reading }) =>
        reading.sentence.shown ? null : (
          <p className="ai-note" key={part}>
            {L.withheld(
              own(L.withheldReason, reading.sentence.withheld) ?? "",
              parts.length > 1 ? part : undefined,
            )}
          </p>
        ),
      )}
    </>
  );
}

/** Each part's words, or why a part has none, in the passage's order. */
function Words({ parts }: { parts: readonly (PartEvent | undefined)[] }) {
  if (!parts.some(Boolean)) return null;
  return (
    <>
      <h4>{L.wordsLabel}</h4>
      <ul className="ai-words">
        {parts.map((part, at) => {
          if (!part) return null;
          if (part.status === "read")
            return part.reading.words.map((word, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the passage's own order
              <WordRow key={`${at}-${index}`} word={word} />
            ));
          const text = own(L.failure, part.state) ?? L.failure.failed;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts' own order
            <li key={at} className="ai-failed">
              {L.partFailed(
                text.charAt(0).toUpperCase() + text.slice(1),
                at + 1,
                parts.length,
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * A button that sends the text, with what it will use beside it, which
 * the button names as its description.
 */
function Offer({
  label,
  note,
  onClick,
}: {
  label: string;
  note?: string;
  onClick: () => void;
}) {
  const id = React.useId();
  return (
    <div className="ai-offer">
      <button
        type="button"
        className="ai-button"
        aria-describedby={note ? id : undefined}
        onClick={onClick}
      >
        {label}
      </button>
      {note && (
        <span className="ai-uses" id={id}>
          {note}
        </span>
      )}
    </div>
  );
}

/** A refusal in plain words, with the reset time where there is one. */
function refusalText(refusal: ReadingRefusal): string {
  switch (refusal.state) {
    case "busy":
      return L.refusal.busy;
    case "off":
      return L.refusal.off;
    case "ceiling":
      return L.refusal.ceiling(clock(refusal.resetAt));
    case "allowance": {
      const time = clock(refusal.resetAt);
      if (refusal.scope === "user")
        return L.refusal.user(refusal.units, refusal.left, refusal.limit, time);
      if (refusal.scope === "client")
        return L.refusal.client(
          refusal.units,
          refusal.left,
          refusal.limit,
          time,
        );
      return L.refusal.anonymous(refusal.units, refusal.left, time);
    }
    case "unavailable":
      return L.refusal.unavailable;
    default:
      return L.refusal.other;
  }
}

/** The words confirmed in a part, and its words. */
const confirmed = (reading: CheckedReading) =>
  reading.words.filter((word) => word.state === "confirmed").length;

/**
 * The offer and, once asked, the card, for one admitted passage: keyed by
 * it, so a new text starts again with the offer.
 */
function Reading({
  translator,
  text,
  admission,
}: {
  translator: Translator;
  text: string;
  admission: Admitted;
}) {
  const session = useSession();
  // Unknown until the session settles: the cost is shown once it is.
  const signedIn = session.isPending ? undefined : Boolean(session.data);
  const [run, setRun] = React.useState<Run | null>(null);
  const [announced, setAnnounced] = React.useState("");
  const controller = React.useRef<AbortController | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const headingId = React.useId();
  const parts = React.useMemo(
    () => readingParts(translator, admission.passage),
    [translator, admission.passage],
  );
  React.useEffect(() => () => controller.current?.abort(), []);

  /**
   * Sends the text. A retry keeps the parts already read: the route serves
   * them from its store and reads only the rest, at the cost of those.
   * "Read again" keeps the reading shown until the new one's first part
   * lands, and keeps it when the new one is refused or lost before then.
   */
  const start = (again: boolean) => {
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    const kept = (run?.parts ?? []).map((part) =>
      isRead(part) ? part : undefined,
    );
    setRun({
      status: "loading",
      parts: kept,
      again,
      replacing: again && kept.some(Boolean),
    });
    setAnnounced(L.starting);
    /** Whether the answer's last line (done, or a refusal) came. */
    let ended = false;
    const current = () => controller.current === mine;
    const update = (change: (was: Run) => Run) =>
      setRun((was) =>
        was && current() && !mine.signal.aborted ? change(was) : was,
      );
    const lose = () =>
      setRun((was) => (was && current() ? { ...was, status: "lost" } : was));
    // The route's own limit and a little more: a stalled answer ends as
    // lost, not "Reading…" for ever.
    const deadline = setTimeout(() => {
      if (ended || !current()) return;
      ended = true;
      lose();
      setAnnounced(L.lost);
      mine.abort();
    }, READING_DEADLINE_MS);
    requestReading(text, {
      again,
      signal: mine.signal,
      onEvent: (event) => {
        if (event.type === "part") {
          update((was) => {
            // The new reading's first part replaces the old one whole.
            const next = was.replacing ? [] : [...was.parts];
            next.length = Math.max(next.length, event.parts);
            next[event.part - 1] = event;
            return {
              ...was,
              parts: next,
              replacing: false,
              arrived: was.arrived || sentToModel(event),
            };
          });
          setAnnounced(
            event.status === "read"
              ? L.announce(
                  event.part,
                  event.parts,
                  confirmed(event.reading),
                  event.reading.words.length,
                )
              : L.partFailed(
                  own(L.failure, event.state) ?? L.failure.failed,
                  event.part,
                  event.parts,
                ),
          );
        } else if (event.type === "done") {
          ended = true;
          update((was) => ({ ...was, status: "finished", done: event }));
        } else {
          ended = true;
          update((was) => ({ ...was, status: "refused", refusal: event }));
          setAnnounced(refusalText(event));
        }
      },
    })
      .then(() => {
        // An answer that ended with no last line was cut short.
        if (ended || mine.signal.aborted) return;
        lose();
        setAnnounced(L.lost);
      })
      .catch(() => {
        if (mine.signal.aborted) return;
        lose();
        setAnnounced(L.lost);
      })
      .finally(() => clearTimeout(deadline));
  };
  // The card's heading takes the focus from the button it replaces.
  const [asked, setAsked] = React.useState(0);
  const begin = (again: boolean) => {
    start(again);
    setAsked((n) => n + 1);
  };
  // After the commit that removed the button, so the heading is there.
  React.useEffect(() => {
    if (asked) heading.current?.focus();
  }, [asked]);

  const uses = (units: number, atMost = false) =>
    signedIn === undefined
      ? undefined
      : L.uses(
          units,
          signedIn,
          USER_DAILY_CHAT_LIMIT,
          CLIENT_DAILY_UNITS,
          atMost,
        );

  // In the page from the start, empty and in the same place whether the
  // offer or the card shows, so its first words are spoken.
  const live = (
    <div className="ai-live" aria-live="polite" style={visuallyHidden}>
      {announced}
    </div>
  );
  if (!run)
    return (
      <>
        {live}
        <Offer
          label={L.offer}
          note={uses(admission.units)}
          onClick={() => begin(false)}
        />
      </>
    );

  const total = Math.max(run.parts.length, parts.length);
  const shown = Array.from({ length: total }, (_, at) => run.parts[at]);
  const read = shown.filter(isRead);
  const allRead = read.length === total;
  const next = shown.findIndex((part) => !part);
  // What a retry reads again: every part without its reading.
  const missing = shown.flatMap((part, at) =>
    isRead(part) ? [] : [parts[at]?.words ?? 0],
  );
  const failed = (states: ReadonlySet<PartFailure>) =>
    shown.some((part) => part?.status === "failed" && states.has(part.state));
  const lost = run.status === "lost";
  // Never after a routing failure or the provider refusing, whatever else
  // failed; else after the model's failures, or an answer that stopped.
  const retryable =
    !failed(NOT_RETRIED) &&
    (lost || (run.status === "finished" && failed(RETRIED)));
  // A failed or lost "Read again" retries as a plain request, which may be
  // served the old reading (or the new one) from the store free, or, if
  // neither is stored, read the whole text: priced "at most" the whole.
  // The route stores none of a new reading until all of it is read.
  const retryUnits = run.again
    ? admission.units
    : readingUnits(missing.reduce((sum, n) => sum + n, 0));
  const refusal = run.refusal;
  const retryRefusal =
    refusal && (refusal.state === "busy" || refusal.state === "unavailable");
  const fromStore =
    read.length > 0 && read.every((part) => part.from === "store");
  const routing = failed(new Set(["routing"]));
  // The text went out: a part was read outside the store, or units were
  // kept (the route refunds them only when no call was made, so a failed
  // run that stopped before any call, such as an unreadable switch, keeps
  // none), or a reply came back routed otherwise.
  const went =
    (read.length > 0 && !fromStore) || (run.done?.units ?? 0) > 0 || routing;

  return (
    <>
      {live}
      <section className="ai-card" aria-labelledby={headingId}>
        <h3 id={headingId} ref={heading} tabIndex={-1}>
          {L.heading}
        </h3>
        <div className="ai-who">{L.who}</div>
        <Sentences parts={shown} />
        <Words parts={shown} />
        {run.status === "loading" && (run.replacing || next !== -1) && (
          <p className="ai-status">
            {shown.some(Boolean) && !run.replacing
              ? L.readingPart(next + 1, total)
              : L.starting}
          </p>
        )}
        {refusal && <p className="ai-status">{refusalText(refusal)}</p>}
        {lost && <p className="ai-status">{L.lost}</p>}
        {lost && <p className="ai-foot">{L.lostSent(Boolean(run.arrived))}</p>}
        {run.status === "finished" && routing && (
          <p className="ai-status">{L.stoppedRouting}</p>
        )}
        {run.status === "finished" && (went || fromStore) && (
          <p className="ai-foot">
            {went ? L.went(read.length > 0, !routing) : L.fromStore}{" "}
            {signedIn !== undefined &&
              L.used(run.done?.units ?? 0, signedIn, USER_DAILY_CHAT_LIMIT)}
          </p>
        )}
        {retryRefusal && (
          <Offer
            label={L.retry}
            // Busy: the reading in hand may be stored by then, free.
            note={refusal.state === "busy" ? undefined : uses(admission.units)}
            onClick={() => begin(run.again)}
          />
        )}
        {retryable && (
          <Offer
            label={
              run.status === "finished" && read.length > 0
                ? L.retryFailed
                : L.retry
            }
            note={uses(retryUnits, lost || run.again)}
            onClick={() => begin(false)}
          />
        )}
        {run.status === "finished" && allRead && (
          <Offer
            label={L.again}
            note={[L.againNote, uses(admission.units)]
              .filter(Boolean)
              .join(", ")}
            onClick={() => begin(true)}
          />
        )}
        <h4>{L.limitationsHeading}</h4>
        <ul className="ai-limits">
          {TRANSLATOR_LIMITATIONS.ai.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * "Read with AI" for an Enochian-into-English result (see the module's
 * comment): nothing when the route wouldn't take `text`, so it is never
 * offered and then refused.
 */
export default function AiReading({
  translator,
  text,
}: {
  translator: Translator;
  /** The text the lookup read, as the route will receive it. */
  text: string;
}) {
  const admission = React.useMemo(
    () => admitReading(translator, text),
    [translator, text],
  );
  if (!admission.ok) return null;
  return (
    <Box sx={styles}>
      <Reading
        key={admission.passage}
        translator={translator}
        text={text}
        admission={admission}
      />
    </Box>
  );
}
