"use client";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ResearchAnswerView,
  ResearchBookDetails,
  researchBookSummary,
} from "./AnswerView";
import type { ResearchAnswer, ResearchBook } from "./answer";
import {
  parseResearchAnswerArchive,
  type ResearchAnswerArchive,
  type ResearchArchiveEntry,
} from "./archive";
import { requestResearchAnswerArchive } from "./browserArchive";
import { requestResearchBookCatalog } from "./browserCatalog";
import {
  requestResearchAnswer,
  requestRetainedResearchAnswer,
} from "./browserRequest";
import { parseResearchBookCatalog, type ResearchBookCatalog } from "./catalog";
import { parseResearchQuestion, type ResearchQuestion } from "./request";

/** Owned request intent. A synchronous snapshot prevents batched UI events from submitting old scope or context. */
interface ResearchQuestionDraft {
  question: string;
  mode: ResearchQuestion["mode"];
  scope: "all" | "selected";
  catalog: ResearchBookCatalog | null;
  bookChoices: [string, string];
  prior: {
    question: string;
    hint: { permit_id: string; expected_answer_id: string } | null;
  } | null;
}
function draftSelection({
  mode,
  scope,
  catalog,
  bookChoices,
}: ResearchQuestionDraft) {
  const selectedCount = mode === "comparison" ? 2 : 1,
    selectedBooks = bookChoices
      .slice(0, selectedCount)
      .map((h) => catalog?.books.find((b) => b.handle === h)),
    scopeResolved =
      (scope === "all" && mode !== "comparison") ||
      (mode !== "inventory" &&
        scope === "selected" &&
        !!catalog &&
        selectedBooks.every(Boolean) &&
        new Set(bookChoices.slice(0, selectedCount)).size === selectedCount);
  return { selectedCount, selectedBooks, scopeResolved };
}
export function SessionResearchChat({
  expiresAt,
  readOnly = false,
}: {
  expiresAt: number;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<ResearchQuestionDraft>(() => ({
      question: "",
      mode: "passage",
      scope: "all",
      catalog: null,
      bookChoices: ["", ""],
      prior: null,
    })),
    [answer, setAnswer] = useState<{
      question: string;
      mode: ResearchQuestion["mode"];
      value: ResearchAnswer;
      source: "new" | "saved";
      scopeLabels: string[];
      scopeBooks: { handle: string; book: ResearchBook }[];
      catalogRevision?: string;
      contextQuestion?: string;
      inputKind?: ResearchArchiveEntry["input_kind"];
    } | null>(null),
    [archive, setArchive] = useState<ResearchAnswerArchive | null>(null),
    [action, setAction] = useState<
      "answer" | "catalog" | "archive" | "reopen" | null
    >(null),
    [error, setError] = useState(false),
    [expired, setExpired] = useState(false),
    [endAt] = useState(
      () => performance.now() + Math.max(0, expiresAt - Date.now()),
    ),
    draftRef = useRef(draft),
    pending = useRef<AbortController | null>(null),
    epoch = useRef(0);
  const { question, mode, scope, catalog, bookChoices, prior } = draft;
  const busy = action !== null;
  // All user intent changes update this owned snapshot before React renders.
  // Async results merge only after the existing epoch/session/visibility guard.
  const updateDraft = useCallback((change: Partial<ResearchQuestionDraft>) => {
    const next = { ...draftRef.current, ...change };
    draftRef.current = next;
    setDraft(next);
  }, []);
  const clear = useCallback(() => {
    epoch.current++;
    updateDraft({
      question: "",
      mode: "passage",
      catalog: null,
      scope: "all",
      bookChoices: ["", ""],
      prior: null,
    });
    pending.current?.abort();
    pending.current = null;
    setAnswer(null);
    setError(false);
    setAction(null);
    setArchive(null);
  }, [updateDraft]);
  const remaining = () =>
    Math.min(expiresAt - Date.now(), endAt - performance.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const left = Math.min(expiresAt - Date.now(), endAt - performance.now());
      if (left <= 0) {
        clear();
        setExpired(true);
      } else timer = setTimeout(tick, Math.min(left, 2147483647));
    };
    tick();
    return () => clearTimeout(timer);
  }, [clear, endAt, expiresAt]);
  useEffect(() => {
    const hide = () => {
        if (document.hidden) clear();
      },
      scrub = () => clear();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", scrub);
    window.addEventListener("pageshow", scrub);
    return () => {
      epoch.current++;
      pending.current?.abort();
      pending.current = null;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", scrub);
      window.removeEventListener("pageshow", scrub);
    };
  }, [clear]);
  const { selectedCount, scopeResolved } = draftSelection(draft);
  const mayCommit = (controller: AbortController, ownEpoch: number) =>
    !controller.signal.aborted &&
    epoch.current === ownEpoch &&
    !document.hidden &&
    remaining() > 0;
  const replacePrior = (prior: ResearchQuestionDraft["prior"]) =>
    updateDraft({ prior });
  const invalidatePrior = () => {
    const selected = draftRef.current.prior;
    if (selected) replacePrior({ ...selected, hint: null });
  };
  const contextResolved = prior === null || prior.hint !== null;
  function selectContext(entry: ResearchArchiveEntry) {
    if (pending.current || document.hidden) return;
    if (remaining() <= 0) {
      clear();
      setExpired(true);
      return;
    }
    const owned = archive?.entries.find(
      (e) =>
        e.permit_id === entry.permit_id &&
        e.answer_id === entry.answer_id &&
        e.input_kind === "original_question",
    );
    if (!owned) return;
    replacePrior({
      question: owned.question,
      hint: { permit_id: owned.permit_id, expected_answer_id: owned.answer_id },
    });
    setError(false);
  }
  async function loadCatalog() {
    if (pending.current || document.hidden) return;
    if (remaining() <= 0) {
      clear();
      setExpired(true);
      return;
    }
    const controller = new AbortController(),
      ownEpoch = ++epoch.current;
    pending.current = controller;
    setAction("catalog");
    setError(false);
    // Choosing/refreshing is explicit selected-scope intent. Failure must never turn it into all-books search.
    updateDraft({ scope: "selected", catalog: null, bookChoices: ["", ""] });
    try {
      const result = parseResearchBookCatalog(
        await requestResearchBookCatalog(controller.signal),
      );
      if (mayCommit(controller, ownEpoch)) updateDraft({ catalog: result });
    } catch {
      if (mayCommit(controller, ownEpoch)) setError(true);
    } finally {
      if (epoch.current === ownEpoch) {
        pending.current = null;
        setAction(null);
      }
    }
  }
  async function loadArchive() {
    if (pending.current || document.hidden) return;
    if (remaining() <= 0) {
      clear();
      setExpired(true);
      return;
    }
    const controller = new AbortController(),
      ownEpoch = ++epoch.current;
    pending.current = controller;
    setAction("archive");
    setError(false);
    setArchive(null);
    setAnswer(null);
    // Refresh discards the old ID mapping; explicit reselection is required.
    invalidatePrior();
    try {
      const result = parseResearchAnswerArchive(
        await requestResearchAnswerArchive(controller.signal),
      );
      if (mayCommit(controller, ownEpoch)) setArchive(result);
    } catch {
      if (mayCommit(controller, ownEpoch)) setError(true);
    } finally {
      if (epoch.current === ownEpoch) {
        pending.current = null;
        setAction(null);
      }
    }
  }
  async function reopen(entry: ResearchArchiveEntry) {
    if (pending.current || document.hidden) return;
    if (remaining() <= 0) {
      clear();
      setExpired(true);
      return;
    }
    if (
      !archive?.entries.some(
        (e) =>
          e.permit_id === entry.permit_id && e.answer_id === entry.answer_id,
      )
    )
      return;
    const selected = { ...entry },
      controller = new AbortController(),
      ownEpoch = ++epoch.current;
    pending.current = controller;
    setAction("reopen");
    setError(false);
    setAnswer(null);
    try {
      const result = await requestRetainedResearchAnswer(
        selected,
        controller.signal,
      );
      if (
        result.answer_id !== selected.answer_id ||
        result.origin !== "model" ||
        result.status !== selected.model_assessment
      )
        throw Error();
      if (mayCommit(controller, ownEpoch))
        setAnswer({
          question: selected.question,
          mode: selected.mode,
          value: result,
          source: "saved",
          ...(selected.input_kind ? { inputKind: selected.input_kind } : {}),
          scopeLabels: [],
          scopeBooks: [],
        });
    } catch {
      if (mayCommit(controller, ownEpoch)) {
        setArchive(null);
        setAnswer(null);
        invalidatePrior();
        setError(true);
      }
    } finally {
      if (epoch.current === ownEpoch) {
        pending.current = null;
        setAction(null);
      }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || document.hidden) return;
    if (remaining() <= 0) {
      clear();
      setExpired(true);
      return;
    }
    const snapshot = draftRef.current,
      {
        question,
        mode,
        scope,
        catalog,
        bookChoices,
        prior: selectedContext,
      } = snapshot,
      { selectedCount, selectedBooks, scopeResolved } =
        draftSelection(snapshot);
    let input: ResearchQuestion;
    try {
      if (!scopeResolved || (selectedContext && !selectedContext.hint))
        throw Error();
      input = parseResearchQuestion({
        question,
        mode,
        ...(selectedContext?.hint
          ? { previous_answer: selectedContext.hint }
          : {}),
        ...(scope === "selected"
          ? {
              source_book_handles: bookChoices.slice(0, selectedCount),
              expected_catalog_revision: catalog!.catalog_revision,
            }
          : {}),
      });
    } catch {
      setError(true);
      return;
    }
    const controller = new AbortController(),
      ownEpoch = ++epoch.current,
      scopeLabels =
        scope === "selected"
          ? selectedBooks.map(
              (b) =>
                researchBookSummary(b!.book) +
                (b!.book.title_status === "catalog_fallback" ||
                b!.book.candidate_fields > 0
                  ? " · bibliographic review pending"
                  : ""),
            )
          : [],
      scopeBooks =
        scope === "selected"
          ? selectedBooks.map((b) => ({
              handle: b!.handle,
              book: structuredClone(b!.book),
            }))
          : [],
      catalogRevision =
        scope === "selected" ? catalog!.catalog_revision : undefined,
      contextQuestion = input.previous_answer
        ? selectedContext!.question
        : undefined;
    pending.current = controller;
    setAction("answer");
    setArchive(null);
    setError(false);
    setAnswer(null);
    try {
      const result = await requestResearchAnswer(input, controller.signal);
      if (
        !controller.signal.aborted &&
        epoch.current === ownEpoch &&
        !document.hidden &&
        remaining() > 0
      )
        setAnswer({
          question: input.question,
          mode: input.mode,
          value: result,
          source: "new",
          scopeLabels,
          scopeBooks,
          ...(catalogRevision ? { catalogRevision } : {}),
          ...(contextQuestion ? { contextQuestion } : {}),
        });
    } catch {
      if (
        !controller.signal.aborted &&
        epoch.current === ownEpoch &&
        !document.hidden &&
        remaining() > 0
      ) {
        setError(true);
        invalidatePrior();
        if (scope === "selected") {
          updateDraft({ catalog: null, bookChoices: ["", ""] });
        }
      }
    } finally {
      if (epoch.current === ownEpoch) {
        pending.current = null;
        setAction(null);
      }
    }
  }
  if (expired || remaining() <= 0)
    return <p>Sign in to use private research.</p>;
  return (
    <Stack spacing={2} sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Typography variant="h4" component="h1">
        Private book research
      </Typography>
      {readOnly ? (
        <Typography>
          Saved answers and citations from the bounded private trial. Expert
          review pending.
        </Typography>
      ) : (
        <Typography>
          Previous answers are not sent automatically. Choose a saved original
          answer below to use as question context, or ask independently. Answers
          and citations only; expert review pending.
        </Typography>
      )}
      {prior ? (
        <section aria-label="Selected question context">
          <h2>Question context</h2>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {prior.question}
          </p>
          <p>
            {prior.hint
              ? "Questions use this saved original answer until you clear it. New source evidence is retrieved for each question."
              : "Choose the original answer again or clear question context before asking."}
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!pending.current) replacePrior(null);
            }}
          >
            Clear question context
          </Button>
        </section>
      ) : null}
      {!readOnly && (
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField
              label="Question"
              value={question}
              onChange={(e) => updateDraft({ question: e.target.value })}
              multiline
              minRows={3}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
            />
            <TextField
              select
              label="Research mode"
              value={mode}
              onChange={(e) => {
                const next = e.target.value as ResearchQuestion["mode"];
                updateDraft({
                  mode: next,
                  bookChoices:
                    next === "inventory"
                      ? ["", ""]
                      : [draftRef.current.bookChoices[0], ""],
                  ...(next === "comparison"
                    ? { scope: "selected" }
                    : next === "inventory"
                      ? { scope: "all" }
                      : {}),
                });
              }}
              disabled={busy}
            >
              <MenuItem value="passage">Passages</MenuItem>
              <MenuItem value="inventory">Prepared book inventory</MenuItem>
              <MenuItem value="comparison">Compare two books</MenuItem>
            </TextField>
            {mode !== "inventory" ? (
              <>
                <TextField
                  select
                  label="Search scope"
                  value={scope}
                  disabled={busy}
                  slotProps={{ select: { native: true } }}
                  onChange={(e) => {
                    updateDraft({
                      scope: e.target.value as "all" | "selected",
                      bookChoices: ["", ""],
                    });
                  }}
                >
                  <option value="all" disabled={mode === "comparison"}>
                    All prepared books
                  </option>
                  <option value="selected">Selected books</option>
                </TextField>
                <Button type="button" disabled={busy} onClick={loadCatalog}>
                  {catalog ? "Refresh book choices" : "Choose books"}
                </Button>
                <Typography variant="body2">
                  Loading book choices uses no model request.
                </Typography>
                {scope === "selected" && catalog ? (
                  <>
                    {Array.from({ length: selectedCount }, (_, i) => (
                      <TextField
                        key={i === 0 ? "first" : "second"}
                        select
                        label={i === 0 ? "First book" : "Second book"}
                        value={bookChoices[i]}
                        disabled={busy}
                        slotProps={{ select: { native: true } }}
                        onChange={(e) =>
                          updateDraft({
                            bookChoices:
                              i === 0
                                ? [
                                    e.target.value,
                                    draftRef.current.bookChoices[1],
                                  ]
                                : [
                                    draftRef.current.bookChoices[0],
                                    e.target.value,
                                  ],
                          })
                        }
                      >
                        <option value="">Choose a book</option>
                        {catalog.books.map((b) => (
                          <option key={b.handle} value={b.handle}>
                            {researchBookSummary(b.book)}
                          </option>
                        ))}
                      </TextField>
                    ))}
                    <details>
                      <summary>Prepared book details</summary>
                      {catalog.books.map((b) => (
                        <section key={b.handle}>
                          <h3>{researchBookSummary(b.book)}</h3>
                          <ResearchBookDetails book={b.book} />
                        </section>
                      ))}
                    </details>
                  </>
                ) : null}
                {!scopeResolved ? (
                  <Typography>
                    Select the requested books, reload choices, or explicitly
                    choose All prepared books.
                  </Typography>
                ) : null}
              </>
            ) : null}
            <Typography variant="body2">
              Submitting may use one paid model request. Cancelling does not
              guarantee that a charge can be avoided.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                disabled={
                  busy || !question.trim() || !scopeResolved || !contextResolved
                }
              >
                Ask
              </Button>
              <Button type="button" onClick={clear}>
                {busy ? "Cancel and clear" : "Clear"}
              </Button>
            </Stack>
          </Stack>
        </form>
      )}
      <Button type="button" disabled={busy} onClick={loadArchive}>
        Previous answers
      </Button>
      <Typography variant="body2">
        {readOnly
          ? "Loading or reopening a saved answer uses no model request. New questions are disabled in this reader."
          : "Loading, reopening or choosing a saved answer uses no model request. Only an explicit Ask sends the selected original answer as quoted context."}
      </Typography>
      {archive ? (
        <section aria-label="Saved completed answers">
          <h2>Saved completed model answers</h2>
          <p>
            Available from this research window only · expert review pending
          </p>
          {archive.entries.length ? (
            <ul>
              {archive.entries.map((entry) => (
                <li key={entry.permit_id}>
                  <p
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {entry.question}
                  </p>
                  <p>
                    Completed at{" "}
                    {new Date(entry.completed_at_ms).toLocaleString()} · model
                    assessment: {entry.model_assessment}
                  </p>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => reopen(entry)}
                  >
                    Open saved answer
                  </Button>
                  {!readOnly && entry.input_kind === "original_question" ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => selectContext(entry)}
                    >
                      Use as question context
                    </Button>
                  ) : !readOnly && entry.input_kind === "follow_up" ? (
                    <p>
                      Saved follow-up · choose an original question for context.
                    </p>
                  ) : !readOnly ? (
                    <p>
                      Refresh previous answers to check context availability.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No saved completed model answers are available in this research
              window.
            </p>
          )}
        </section>
      ) : null}
      {action ? (
        <p role="status">
          {
            {
              answer: "Preparing a complete answer…",
              catalog: "Loading book choices…",
              archive: "Loading saved answers…",
              reopen: "Opening a saved answer…",
            }[action]
          }
        </p>
      ) : null}
      {error ? (
        <Alert severity="warning">
          Private research unavailable. No automatic retry was made.
        </Alert>
      ) : null}
      {answer ? (
        <section aria-label="Completed research">
          <h2>
            {answer.source === "saved"
              ? "Saved answer to your question"
              : "Answer to your question"}
          </h2>
          <p>
            {answer.mode === "inventory"
              ? "Prepared book inventory"
              : answer.mode === "comparison"
                ? "Comparison"
                : "Passages"}
          </p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {answer.question}
          </p>
          <p>
            {answer.source === "saved"
              ? "Sources shown are from the saved answer."
              : answer.scopeLabels.length
                ? "Requested books: " + answer.scopeLabels.join(" / ")
                : "All prepared books"}
          </p>
          {answer.contextQuestion ? (
            <section aria-label="Submitted question context">
              <h3>Question context requested</h3>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {answer.contextQuestion}
              </p>
            </section>
          ) : answer.source === "saved" && answer.inputKind === "follow_up" ? (
            <p>
              Saved follow-up; the original question context is not shown in
              this view.
            </p>
          ) : null}
          {answer.scopeBooks.length ? (
            <section aria-label="Submitted book details">
              {answer.scopeBooks.map(({ handle, book }, index) => (
                <section key={answer.catalogRevision + ":" + handle}>
                  <h3>
                    {index === 0
                      ? "First requested book"
                      : "Second requested book"}{" "}
                    · {answer.scopeLabels[index]}
                  </h3>
                  <ResearchBookDetails book={book} />
                </section>
              ))}
            </section>
          ) : null}
          <ResearchAnswerView value={answer.value} />
        </section>
      ) : null}
    </Stack>
  );
}
