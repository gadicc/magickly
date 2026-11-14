// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ResearchAnswerView } from "./AnswerView";
import { noResearchEvidenceAnswer } from "./answer";
import { ANSWER_ID, answerFixture } from "./answer.fixture";

afterEach(cleanup);
it("renders literal statements with qualified citations and local answer-scoped links", () => {
  const value = answerFixture();
  value.statements[0].text =
    '<img src="https://external.example/private"> **literal** [link](javascript:alert(1))';
  const { container } = render(<ResearchAnswerView value={value} />);
  expect(container.querySelector("img,iframe,script,video,object")).toBeNull();
  expect(screen.getByText(value.statements[0].text)).toBeTruthy();
  expect(container.textContent).toContain(
    "Synthetic Author · Synthetic book: Synthetic subtitle · Synthetic Press · Second edition · publication 2020 · local PDF pp.2–3",
  );
  expect(container.textContent).toContain("expert review pending");
  expect(container.textContent).toContain(
    "no printed-page equivalence is implied",
  );
  for (const a of container.querySelectorAll("a")) {
    expect(a.getAttribute("href")).toMatch(
      new RegExp("^#research-" + ANSWER_ID),
    );
    expect(container.querySelector(a.getAttribute("href")!)).toBeTruthy();
  }
  expect(container.textContent).not.toContain("catalog title unverified");
});
it("preserves contributor/date/OCR/candidate notes without collapsing edition facts", () => {
  const value = answerFixture(),
    c = value.citations[0];
  if (c.kind !== "pdf_passage") throw Error();
  c.book.contributors.push(
    { name: "Editor", role: "editor" },
    { name: "Translator", role: "translator" },
    { name: "Foreword", role: "foreword" },
  );
  c.book.dates = [
    { kind: "original_publication", year: 1900 },
    { kind: "digital_edition", year: 2021 },
  ];
  c.book.volume = "Volume II";
  c.book.title_status = "catalog_fallback";
  c.book.candidate_fields = 2;
  c.book.notes = ["Observed note."];
  c.physical_pdf_page_end = 2;
  c.extraction = "unverified_ocr";
  const inv = value.citations[1];
  if (inv.kind !== "prepared_inventory") throw Error();
  inv.books[0].book = structuredClone(c.book);
  const { container } = render(<ResearchAnswerView value={value} />);
  for (const text of [
    "Editor (ed.)",
    "Translator (trans.)",
    "digital edition 2021",
    "original publication: 1900",
    "foreword: Foreword",
    "local PDF p.2 · unverified OCR",
    "bibliographic review pending",
    "2 extracted field observations",
    "Observed note.",
    "ISBN (paperback)",
  ])
    expect(container.textContent).toContain(text);
});
it("keeps ambiguous publication dates in details and invents no summary year", () => {
  const value = answerFixture();
  for (const c of value.citations)
    if (c.kind === "pdf_passage")
      c.book.dates.push({ kind: "publication", year: 2022 });
    else c.books[0].book.dates.push({ kind: "publication", year: 2022 });
  const { container } = render(<ResearchAnswerView value={value} />);
  expect(container.textContent).not.toContain("publication 2020");
  expect(container.textContent).toContain("publication: 2020");
  expect(container.textContent).toContain("publication: 2022");
});
it("keeps inventory and source-free outcomes distinct from absent-library claims", () => {
  const { container, rerender } = render(
    <ResearchAnswerView value={answerFixture()} />,
  );
  expect(container.textContent).toContain("2 admitted PDF artifacts.");
  expect(container.textContent).toContain(
    "Wider-library coverage and index membership are not established.",
  );
  rerender(<ResearchAnswerView value={noResearchEvidenceAnswer(ANSWER_ID)} />);
  expect(screen.queryByRole("region", { name: "Citations" })).toBeNull();
  expect(container.textContent).toContain("Prepared snapshot result");
  expect(container.textContent).toContain("does not establish absence");
});
it("refuses malformed graphs before rendering a misleading partial answer", () => {
  const value = answerFixture();
  value.statements[0].evidence_ids = ["passage4"];
  expect(() => ResearchAnswerView({ value })).toThrow(
    "Private research answer unavailable",
  );
});
