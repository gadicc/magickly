/** Literal typed rendering only. No Markdown, HTML, excerpt, image or source-file URL projection. */
import { parseResearchAnswer, type ResearchBook } from "./answer";

const label = (value: string) => value.replaceAll("_", " ");
const unique = <T,>(values: T[]) => [
  ...new Map(values.map((value) => [JSON.stringify(value), value])).values(),
];
/** Literal qualified bibliographic summary shared with the authorized book picker. */
export function researchBookSummary(book: ResearchBook) {
  const contributors = book.contributors
    .filter(
      (c) =>
        c.role === "author" || c.role === "editor" || c.role === "translator",
    )
    .map(
      (c) =>
        c.name +
        (c.role === "author"
          ? ""
          : c.role === "editor"
            ? " (ed.)"
            : " (trans.)"),
    );
  const parts = [
    contributors.join("; "),
    book.title + (book.subtitle ? ": " + book.subtitle : ""),
    book.volume,
    book.publisher,
    book.edition,
  ].filter(Boolean);
  const kind = [
    "publication",
    "digital_edition",
    "first_printing",
    "first_publication",
    "first_paperback",
  ].find((k) => book.dates.some((d) => d.kind === k));
  const dates = book.dates.filter((d) => d.kind === kind);
  if (dates.length === 1)
    parts.push(label(dates[0].kind) + " " + dates[0].year);
  return parts.join(" · ");
}
/** Literal field observations; missing or unreviewed facts remain qualified. */
export function ResearchBookDetails({ book }: { book: ResearchBook }) {
  return (
    <details>
      <summary>Bibliographic details</summary>
      {unique(book.contributors).map((c) => (
        <p key={JSON.stringify(c)}>
          {label(c.role)}: {c.name}
        </p>
      ))}
      {(["publisher", "edition", "volume", "language"] as const).map((key) =>
        book[key] ? (
          <p key={key}>
            {key}: {book[key]}
          </p>
        ) : null,
      )}
      {unique(book.dates).map((d) => (
        <p key={JSON.stringify(d)}>
          {label(d.kind)}: {d.year}
        </p>
      ))}
      {unique(book.isbns).map((i) => (
        <p key={JSON.stringify(i)}>
          ISBN ({i.format}): {i.value}
        </p>
      ))}
      {[...new Set(book.notes)].map((note) => (
        <p key={note}>{note}</p>
      ))}
      {book.title_status === "catalog_fallback" ? (
        <p>Title uses catalog metadata; bibliographic review pending.</p>
      ) : null}
      {book.candidate_fields ? (
        <p>
          {book.candidate_fields} extracted field observations await review.
        </p>
      ) : null}
    </details>
  );
}
/** Validate again before rendering. Structural validity and source links are not an expert accuracy judgment. */
export function ResearchAnswerView({ value }: { value: unknown }) {
  const answer = parseResearchAnswer(value),
    prefix = "research-" + answer.answer_id,
    citationId = (id: string) => prefix + "-citation-" + id,
    statementId = (id: string) => prefix + "-statement-" + id,
    inventory = answer.citations.find((c) => c.kind === "prepared_inventory");
  return (
    <article aria-label="Research answer">
      <p>
        {answer.origin === "model"
          ? "Model assessment: "
          : "Prepared snapshot result: "}
        {answer.status} · expert review pending
      </p>
      {answer.statements.map((s) => (
        <section key={s.id} id={statementId(s.id)}>
          <h3>
            {s.id} ·{" "}
            {s.kind === "answer"
              ? "Answer"
              : s.kind === "observation"
                ? "Observation"
                : "Evidence limit"}
          </h3>
          <small>
            {s.basis === "passage"
              ? "Attributed to selected evidence"
              : s.basis === "inventory"
                ? "Prepared collection inventory"
                : "Limits of the supplied context"}
          </small>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {s.text}
          </p>
          {s.evidence_ids.length ? (
            <p>
              Sources:{" "}
              {s.evidence_ids.map((id) => (
                <span key={id}>
                  <a href={"#" + citationId(id)}>{id}</a>{" "}
                </span>
              ))}
            </p>
          ) : null}
          {s.book_handles.length ? (
            <p>
              Named books:{" "}
              {s.book_handles.map((handle) => (
                <span key={handle}>
                  <a href={"#" + citationId("inventory1-book-" + handle)}>
                    {
                      inventory?.books.find((entry) => entry.handle === handle)
                        ?.book.title
                    }
                  </a>{" "}
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ))}
      {answer.issues.map((issue) => (
        <p key={JSON.stringify(issue)}>
          {label(issue.kind)} ·{" "}
          {issue.affects_answer ? "affects this answer" : "context note"} ·{" "}
          {issue.statement_ids.map((id) => (
            <span key={id}>
              <a href={"#" + statementId(id)}>{id}</a>{" "}
            </span>
          ))}
        </p>
      ))}
      {answer.citations.length ? (
        <section aria-label="Citations">
          <h3>Citations</h3>
          <ul>
            {answer.citations.map((c) => (
              <li key={c.id} id={citationId(c.id)}>
                {c.kind === "pdf_passage" ? (
                  <>
                    <p>
                      {c.id} · {researchBookSummary(c.book)} · local PDF{" "}
                      {c.physical_pdf_page_start === c.physical_pdf_page_end
                        ? "p."
                        : "pp."}
                      {c.physical_pdf_page_start}
                      {c.physical_pdf_page_end !== c.physical_pdf_page_start
                        ? "–" + c.physical_pdf_page_end
                        : ""}
                      {c.extraction === "unverified_ocr"
                        ? " · unverified OCR"
                        : ""}
                    </p>
                    <ResearchBookDetails book={c.book} />
                  </>
                ) : (
                  <>
                    <h4>{c.id} · Prepared collection inventory</h4>
                    <p>
                      {c.source_count} admitted PDF artifacts. Wider-library
                      coverage and index membership are not established.
                    </p>
                    <ul>
                      {c.books.map(({ handle, book }) => (
                        <li
                          key={handle}
                          id={citationId("inventory1-book-" + handle)}
                        >
                          <p>{researchBookSummary(book)}</p>
                          <ResearchBookDetails book={book} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {answer.citations.some((c) => c.kind === "pdf_passage") ? (
        <p>
          <small>
            Local PDF pages refer to converted files; no printed-page
            equivalence is implied.
          </small>
        </p>
      ) : null}
    </article>
  );
}
