/** Synthetic documents only: no owned book text, source cache, provider or service. */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { queryFixture } from "../../../src/chat-research/query.fixture";
import { runOfflineSectionCases } from "./experiment.mts";
import {
  normalizeSectionPage,
  offlineOrdinalIntent,
  SECTION_ERROR,
  scanStepHeadings,
  sectionOrdinal,
} from "./headings.mts";
import {
  buildOfflineSectionIndex,
  inspectOfflineSections,
  type OfflineSectionInputs,
  type OfflineSectionPage,
  prepareOfflineSectionParent,
  proposeOfflineSection,
} from "./index.mts";

vi.mock("server-only", () => ({}));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
type Fixture = {
  catalog: OfflineSectionInputs["catalog"];
  units: { unit_id: string; text: string }[];
  page_index_sha256: string;
  pages: OfflineSectionPage[];
};
function fixture(
  pageTexts = [
    "CONTENTS\n\nSTEP I\n\nSYNTHETIC TOPIC .... 2",
    "STEP I\n\nSYNTHETIC OBSERVATION\n\nObserve a painted square for three breaths.",
    "Repeat the synthetic practice after lunch.",
    "STEP II\n\nSYNTHETIC REST\n\nA separate fictional exercise.",
  ],
): Fixture {
  const source = structuredClone(queryFixture().input.sources[0]);
  source.pdf_pages = pageTexts.length;
  const values = pageTexts.flatMap((text, p) =>
    normalizeSectionPage(text)
      .split("\n\n")
      .filter(Boolean)
      .map((text, i) => ({ unit_id: `z${p}_${99 - i}`, text, page: p + 1 })),
  );
  source.units = values.map((u) => ({
    id: u.unit_id,
    page_start: u.page,
    page_end: u.page,
    extraction: "native_text",
    text_sha256: sha(u.text),
  }));
  return {
    catalog: { schema_version: 1, sources: [source] },
    units: values.map(({ unit_id, text }) => ({ unit_id, text })),
    page_index_sha256: sha("Synthetic independently pinned page index"),
    pages: pageTexts.map((text, p) => ({
      source_id: source.source_id,
      source_version: source.source_version,
      page: p + 1,
      extraction: "native_text",
      cache_manifest_sha256: sha("synthetic manifest " + p),
      raw_sha256: sha(text),
      text,
    })),
  };
}
const query = (
  index: ReturnType<typeof buildOfflineSectionIndex>,
  overrides: Partial<Parameters<typeof proposeOfflineSection>[1]> = {},
) =>
  proposeOfflineSection(index, {
    query: "How is the first exercise practised?",
    source_ids: ["source1"],
    ...overrides,
  });
it("finds the body section rather than contents and assembles whole units in page/span order", () => {
  const f = fixture(),
    index = buildOfflineSectionIndex(f),
    result = query(index, { max_units: 4 });
  expect(result.status).toBe("candidate");
  if (result.status !== "candidate") throw Error();
  expect(result.anchor.page).toBe(2);
  expect(result.boundary?.page).toBe(4);
  expect(result.selected_unit_ids).toEqual([
    "z1_99",
    "z1_98",
    "z1_97",
    "z2_99",
  ]);
  expect(result.complete_section).toBe(true);
  expect(result.truncated).toBe(false);
  expect(
    inspectOfflineSections(index, "source1").headings[0].contents_candidate,
  ).toBe(true);
});
it("keeps the opening-exercise inference explicit rather than turning it into a semantic label", () => {
  const r = query(buildOfflineSectionIndex(fixture()), {
    query: "Describe the opening exercise",
  });
  expect(r.status).toBe("candidate");
  if (r.status === "candidate") expect(r.opening_inferred).toBe(true);
});
it.each([
  "Describe the opening ritual",
  "Which preparations belong to the first system?",
  "Which parts of that routine are required?",
  "Describe both books' first exercise",
  "Describe the first and second exercise",
  "Describe step I and II",
  "Describe the first or third exercise",
  "Describe the first exercise and second step",
  "Not the first exercise",
  "Not the opening exercise",
  "Do not explain the first exercise",
  "Explain Step I–III",
  "Step 1-3",
  "Step I to III",
  "first through third exercise",
  "first exercise through third",
  "first step until third",
  "first exercise & third",
  "Step I & III",
  "first—third exercise",
  "Don’t explain step I",
  "Except the fourth step",
  "Other than step IV",
  "Describe step IIII",
  "Describe step 0",
  "Describe step 33",
])("abstains from unsupported or ambiguous intent: %s", (question) => {
  const r = query(buildOfflineSectionIndex(fixture()), { query: question });
  expect(r.status).toBe("ambiguous_intent");
  expect(r.selected_unit_ids).toEqual([]);
});
it.each([
  ["I", 1],
  ["iv", 4],
  ["IX", 9],
  ["XXXII", 32],
  ["32", 32],
  ["01", undefined],
  ["IIII", undefined],
  ["IL", undefined],
  ["33", undefined],
  ["", undefined],
] as const)("parses canonical bounded ordinal %s", (text, n) =>
  expect(sectionOrdinal(text)).toBe(n),
);
it("normalizes NFC, formfeeds and paragraph whitespace with explicit UTF16 rather than raw offsets", () => {
  const text = " 😀\n\nSTEP 1: FICTIONAL CAFe\u0301\n\nBody text.\f ",
    canonical = normalizeSectionPage(text),
    h = scanStepHeadings(canonical)[0];
  expect(canonical).toContain("CAFé");
  expect(canonical.slice(h.start, h.end)).toBe("STEP 1: FICTIONAL CAFé");
  expect(h.start).toBe(4);
});
it("accepts a wrapped title only in the canonical paragraph coordinate system", () => {
  const h = scanStepHeadings(
    normalizeSectionPage("STEP II\n\nSYNTHETIC\nWRAPPED TITLE\n\nBody"),
  )[0];
  expect(h.title).toBe("SYNTHETIC WRAPPED TITLE");
  expect(scanStepHeadings("We mention Step I inside ordinary prose.")).toEqual(
    [],
  );
});
it("retains inline contents leaders and missing/oversize titles without promoting them", () => {
  expect(scanStepHeadings("Step 1: TOPIC .... 14")[0].contents_candidate).toBe(
    true,
  );
  expect(scanStepHeadings("STEP I")[0].uncertain_marker).toBe(true);
  expect(scanStepHeadings("STEP I\n\nSTEP II\n\nTITLE")).toHaveLength(2);
  expect(
    scanStepHeadings("STEP I\n\n" + "X".repeat(121))[0].uncertain_marker,
  ).toBe(true);
  expect(
    scanStepHeadings("STEP I\n\n" + "X ".repeat(17).trim())[0].uncertain_marker,
  ).toBe(true);
});
it("bounds candidate headings per page", () =>
  expect(() =>
    scanStepHeadings(
      Array.from({ length: 65 }, () => "STEP I\n\nFICTIONAL TITLE").join(
        "\n\n",
      ),
    ),
  ).toThrow(SECTION_ERROR));
it("does not silently choose the first body occurrence of a restarted sequence", () => {
  const f = fixture([
    "STEP I\n\nFIRST TOPIC",
    "STEP II\n\nNEXT TOPIC",
    "STEP I\n\nRESTARTED TOPIC",
  ]);
  expect(query(buildOfflineSectionIndex(f)).status).toBe("ambiguous_heading");
});
it("does not promote unverified OCR headings", () => {
  const f = fixture();
  f.pages[1].extraction = "unverified_ocr";
  for (const u of f.catalog.sources[0].units)
    if (u.page_start === 2) u.extraction = "unverified_ocr";
  expect(query(buildOfflineSectionIndex(f)).status).toBe(
    "unverified_extraction",
  );
});
it.each([
  ["STEP I\n\nTOPIC", "STEP III\n\nGAP"],
  ["STEP I\n\nTOPIC", "STEP V\n\nINTERVENING", "STEP II\n\nNEXT"],
  ["STEP I\n\nTOPIC", "STEP II\n\nREPEATED", "STEP II\n\nREPEATED"],
  ["STEP I\n\nLAST TOPIC"],
  ["STEP II\n\nEARLIER", "STEP I\n\nLATER"],
])("keeps missing, restarted or nonconsecutive boundaries open", (...pages) => {
  const r = query(buildOfflineSectionIndex(fixture(pages)));
  expect(r.status).toBe("candidate");
  if (r.status === "candidate") {
    expect(r.open_end).toBe(true);
    expect(r.complete_section).toBe(false);
  }
});
it("does not trust an OCR next boundary", () => {
  const f = fixture();
  f.pages[3].extraction = "unverified_ocr";
  for (const u of f.catalog.sources[0].units)
    if (u.page_start === 4) u.extraction = "unverified_ocr";
  const r = query(buildOfflineSectionIndex(f));
  if (r.status !== "candidate") throw Error();
  expect(r.open_end).toBe(true);
});
it("reports a missing heading instead of inferring one from ordinary prose", () =>
  expect(
    query(buildOfflineSectionIndex(fixture(["Plain synthetic text"]))).status,
  ).toBe("missing_heading"));
it("does not invent coverage when registered units omit non-whitespace section content", () => {
  const f = fixture();
  f.units = f.units.filter((u) => u.unit_id !== "z1_97");
  f.catalog.sources[0].units = f.catalog.sources[0].units.filter(
    (u) => u.id !== "z1_97",
  );
  const r = query(buildOfflineSectionIndex(f));
  if (r.status !== "candidate") throw Error();
  expect(r.registered_section_coverage_complete).toBe(false);
  expect(r.complete_section).toBe(false);
});
it("does not call an empty registered section complete", () => {
  const f = fixture();
  f.units = [];
  f.catalog.sources[0].units = [];
  const r = query(buildOfflineSectionIndex(f));
  if (r.status !== "candidate") throw Error();
  expect(r.complete_section).toBe(false);
  expect(r.selected_unit_ids).toEqual([]);
});
it("keeps byte and unit truncation visible and never slices registered units", () => {
  const index = buildOfflineSectionIndex(fixture());
  const r = query(index, { max_units: 1 });
  if (r.status !== "candidate") throw Error();
  expect(r.selected_unit_ids).toHaveLength(1);
  expect(r.truncated).toBe(true);
  expect(r.selected_section_coverage_complete).toBe(false);
  const tiny = query(index, { max_text_bytes: 1 });
  if (tiny.status !== "candidate") throw Error();
  expect(tiny.selected_unit_ids).toEqual([]);
  expect(tiny.selected_text_bytes).toBe(0);
  expect(tiny.complete_section).toBe(false);
});
it("marks units which cross a section boundary instead of creating unregistered excerpt slices", () => {
  const f = fixture(["STEP I\n\nTOPIC\n\nBody\n\nSTEP II\n\nNEXT"]);
  const text = normalizeSectionPage(f.pages[0].text);
  (f as { units: OfflineSectionInputs["units"] }).units = [
    { unit_id: "whole", text },
  ];
  f.catalog.sources[0].units = [
    {
      id: "whole",
      page_start: 1,
      page_end: 1,
      extraction: "native_text",
      text_sha256: sha(text),
    },
  ];
  const r = query(buildOfflineSectionIndex(f));
  if (r.status !== "candidate") throw Error();
  expect(r.boundary_crossing_unit_ids).toEqual(["whole"]);
  expect(r.complete_section).toBe(false);
});
it("reports prefix crossing too", () => {
  const f = fixture(["PREFACE\n\nSTEP I\n\nTOPIC", "STEP II\n\nNEXT"]),
    text = normalizeSectionPage(f.pages[0].text);
  (f as { units: OfflineSectionInputs["units"] }).units = f.units.filter(
    (u) => !u.unit_id.startsWith("z0"),
  );
  f.catalog.sources[0].units = f.catalog.sources[0].units.filter(
    (u) => u.page_start !== 1,
  );
  f.units.push({ unit_id: "prefix", text });
  f.catalog.sources[0].units.push({
    id: "prefix",
    page_start: 1,
    page_end: 1,
    extraction: "native_text",
    text_sha256: sha(text),
  });
  const r = query(buildOfflineSectionIndex(f));
  if (r.status !== "candidate") throw Error();
  expect(r.boundary_crossing_unit_ids).toEqual(["prefix"]);
});
it.each(["missing", "repeated", "multi_page"])(
  "preserves unresolved %s page/unit ordering",
  (kind) => {
    const f = fixture();
    const u = f.units.find((u) => u.unit_id === "z1_97")!;
    if (kind === "missing")
      u.text = "A registered but unlocated synthetic paragraph.";
    if (kind === "repeated") {
      const text = f.pages[1].text + "\n\n" + u.text;
      f.pages[1].text = text;
      f.pages[1].raw_sha256 = sha(text);
    }
    const actual = f.catalog.sources[0].units.find((x) => x.id === u.unit_id)!;
    actual.text_sha256 = sha(u.text);
    if (kind === "multi_page") actual.page_end = 3;
    const index = buildOfflineSectionIndex(f);
    expect(index.unmapped_units).toBeGreaterThan(0);
    expect(query(index).status).toBe("unresolved_order");
  },
);
it("counts overlapping substring occurrences toward ambiguity", () => {
  const f = fixture(["STEP I\n\nTOPIC\n\naaaa", "STEP II\n\nNEXT"]);
  f.units.push({ unit_id: "overlap-text", text: "aaa" });
  f.catalog.sources[0].units.push({
    id: "overlap-text",
    page_start: 1,
    page_end: 1,
    extraction: "native_text",
    text_sha256: sha("aaa"),
  });
  expect(query(buildOfflineSectionIndex(f)).status).toBe("unresolved_order");
});
it("does not fabricate a total order for overlapping registered chunks", () => {
  const f = fixture();
  f.units.push({ unit_id: "same-position", text: "STEP I" });
  f.catalog.sources[0].units.push({
    id: "same-position",
    page_start: 2,
    page_end: 2,
    extraction: "native_text",
    text_sha256: sha("STEP I"),
  });
  expect(query(buildOfflineSectionIndex(f)).status).toBe("overlapping_units");
});
it("requires complete page coverage, exact hashes and aligned native/OCR provenance", () => {
  for (const change of [
    (f: Fixture) => {
      (f as { pages: OfflineSectionInputs["pages"] }).pages = f.pages.slice(1);
    },
    (f: Fixture) => {
      f.pages[0].raw_sha256 = sha("wrong");
    },
    (f: Fixture) => {
      f.units[0].text = "changed";
    },
    (f: Fixture) => {
      f.pages[0].extraction = "unverified_ocr";
    },
    (f: Fixture) => {
      f.pages[0].source_version = sha("other");
    },
    (f: Fixture) => {
      f.pages[0].page = 99;
    },
    (f: Fixture) => {
      f.pages[1] = f.pages[0];
    },
  ]) {
    const f = fixture();
    change(f);
    expect(() => buildOfflineSectionIndex(f)).toThrow(SECTION_ERROR);
  }
});
it("supports genuinely empty primary pages without creating sections", () => {
  const f = fixture([""]);
  f.pages[0].extraction = "no_text";
  const i = buildOfflineSectionIndex(f);
  expect(i.heading_count).toBe(0);
  expect(query(i).status).toBe("missing_heading");
  f.pages[0].text = "Not empty";
  f.pages[0].raw_sha256 = sha(f.pages[0].text);
  expect(() => buildOfflineSectionIndex(f)).toThrow(SECTION_ERROR);
});
it("owns inputs and copies detailed outputs", () => {
  const f = fixture(),
    i = buildOfflineSectionIndex(f),
    before = query(i);
  f.pages[1].text = "changed";
  f.units[0].text = "changed";
  const detail = inspectOfflineSections(i, "source1");
  (detail.headings[1] as { title: string }).title = "changed";
  expect(query(i)).toEqual(before);
  expect(() => query({ ...i })).toThrow(SECTION_ERROR);
  expect(() => inspectOfflineSections(i, "unknown")).toThrow(SECTION_ERROR);
});
it("keeps all sources in the sidecar influence identity while source-scoping the candidate", () => {
  const f = fixture(),
    other = fixture(["STEP I\n\nUNRELATED TOPIC", "STEP II\n\nUNRELATED NEXT"]),
    s = other.catalog.sources[0];
  s.source_id = "source2";
  s.source_version = sha("second synthetic source");
  for (const u of s.units) u.id = "other_" + u.id;
  other.units = other.units.map((u) => ({
    ...u,
    unit_id: "other_" + u.unit_id,
  }));
  for (const p of other.pages) {
    p.source_id = "source2";
    p.source_version = s.source_version;
  }
  f.catalog.sources.push(s);
  (f as { units: OfflineSectionInputs["units"] }).units = [
    ...f.units,
    ...other.units,
  ];
  (f as { pages: OfflineSectionInputs["pages"] }).pages = [
    ...f.pages,
    ...other.pages,
  ];
  const a = buildOfflineSectionIndex(f),
    r = query(a);
  if (r.status !== "candidate") throw Error();
  expect(r.selected_unit_ids.every((id) => !id.startsWith("other"))).toBe(true);
  const p = f.pages.find((p) => p.source_id === "source2")!;
  p.text += " ";
  p.raw_sha256 = sha(p.text);
  const b = buildOfflineSectionIndex(f);
  expect(b.revision).not.toBe(a.revision);
  expect(query(b, { source_ids: ["source1", "source2"] }).status).toBe(
    "ambiguous_intent",
  );
});
it.each([
  { query: "" },
  { query: "x".repeat(4001) },
  { query: "\ud800" },
  { source_ids: [] },
  { source_ids: ["unknown"] },
  { source_ids: ["source1", "source1"] },
  { max_units: 0 },
  { max_units: 5 },
  { max_text_bytes: 0 },
  { max_text_bytes: 64001 },
])("rejects malformed or excessive request", (bad) =>
  expect(() => query(buildOfflineSectionIndex(fixture()), bad)).toThrow(
    SECTION_ERROR,
  ),
);

it("keeps explicit identical ordinal forms consistent", () => {
  expect(offlineOrdinalIntent("Explain first exercise, Step I")).toEqual({
    ordinal: 1,
    opening_inferred: false,
  });
});

it("packs a complete private parent with exact canonical span lineage and no active-corpus compatibility", () => {
  const i = buildOfflineSectionIndex(fixture()),
    r = prepareOfflineSectionParent(i, {
      query: "first exercise",
      source_ids: ["source1"],
    });
  expect(r.status).toBe("prepared");
  if (r.status !== "prepared") throw Error();
  expect(r.text).toBe(
    "STEP I\n\nSYNTHETIC OBSERVATION\n\nObserve a painted square for three breaths.\n\nRepeat the synthetic practice after lunch.",
  );
  expect(r.text_sha256).toBe(sha(r.text));
  expect(r.spans.map((p) => p.page)).toEqual([2, 3]);
  expect(r.page_end).toBe(3);
  expect(r.requires_new_catalog_registration).toBe(true);
  expect(r.compatible_with_active_corpus).toBe(false);
});
it("keeps parent provenance blocked for ambiguous intent, open ends and missing registered coverage", () => {
  const i = buildOfflineSectionIndex(fixture());
  expect(
    prepareOfflineSectionParent(i, {
      query: "that routine",
      source_ids: ["source1"],
    }).status,
  ).toBe("blocked");
  const open = buildOfflineSectionIndex(fixture(["STEP I\n\nTOPIC"]));
  expect(
    prepareOfflineSectionParent(open, {
      query: "first step",
      source_ids: ["source1"],
    }),
  ).toMatchObject({
    status: "blocked",
    reason: "incomplete_section_provenance",
  });
});
it("does not hide OCR or empty-primary visual uncertainty in a packed section", () => {
  for (const empty of [false, true]) {
    const f = fixture();
    f.pages[2].extraction = empty ? "no_text" : "unverified_ocr";
    if (empty) {
      f.pages[2].text = "";
      f.pages[2].raw_sha256 = sha("");
      f.units = f.units.filter((u) => u.unit_id !== "z2_99");
      f.catalog.sources[0].units = f.catalog.sources[0].units.filter(
        (u) => u.id !== "z2_99",
      );
    } else
      for (const u of f.catalog.sources[0].units)
        if (u.page_start === 3) u.extraction = "unverified_ocr";
    const i = buildOfflineSectionIndex(f),
      r = query(i);
    if (r.status !== "candidate") throw Error();
    expect(r.all_section_pages_native).toBe(false);
    expect(r.complete_section).toBe(false);
    if (!empty) expect(r.unverified_ocr_unit_ids).toEqual(["z2_99"]);
    expect(
      prepareOfflineSectionParent(i, {
        query: "first step",
        source_ids: ["source1"],
      }),
    ).toMatchObject({ status: "blocked", reason: "unverified_section_page" });
  }
});
it("keeps parent character and UTF8 budgets distinct and never clips oversized context", () => {
  const large = buildOfflineSectionIndex(
    fixture(["STEP I\n\nTOPIC", "x".repeat(16000), "STEP II\n\nNEXT"]),
  );
  expect(
    prepareOfflineSectionParent(
      large,
      { query: "first step", source_ids: ["source1"] },
      64000,
    ).status,
  ).toBe("too_large");
  const unicode = buildOfflineSectionIndex(
    fixture(["STEP I\n\nTOPIC", "漢".repeat(5000), "STEP II\n\nNEXT"]),
  );
  expect(
    prepareOfflineSectionParent(unicode, {
      query: "first step",
      source_ids: ["source1"],
    }).status,
  ).toBe("too_large");
  expect(
    prepareOfflineSectionParent(
      unicode,
      { query: "first step", source_ids: ["source1"] },
      20000,
    ).status,
  ).toBe("prepared");
  expect(() =>
    prepareOfflineSectionParent(
      unicode,
      { query: "first step", source_ids: ["source1"] },
      0,
    ),
  ).toThrow();
});
it("compares source-free offline controls without exposing titles, parent text or questions", async () => {
  const f = fixture(),
    c = [
      { id: "positive", query: "first step", source_ids: ["source1"] },
      { id: "negative", query: "that routine", source_ids: ["source1"] },
    ];
  const pending = runOfflineSectionCases({ input: f, cases: c });
  f.units[0].text = "mutated";
  c[0].query = "mutated";
  const r = await pending;
  expect(r.cases.map((c) => c.status)).toEqual([
    "candidate",
    "ambiguous_intent",
  ]);
  expect(r.cases[0].parent.status).toBe("prepared");
  expect(JSON.stringify(r)).not.toContain("Observe a painted square");
  expect(JSON.stringify(r)).not.toContain('"query":');
});
it("rejects duplicate or prose-shaped case IDs instead of exporting arbitrary text", async () => {
  const f = fixture(),
    c = { id: "same", query: "first step", source_ids: ["source1"] };
  await expect(
    runOfflineSectionCases({ input: f, cases: [c, c] }),
  ).rejects.toThrow();
  await expect(
    runOfflineSectionCases({
      input: f,
      cases: [{ ...c, id: "Private text is not a case ID." }],
    }),
  ).rejects.toThrow();
});
it("executes the actual offline CLI on synthetic stdin and sanitizes failed parses", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url)),
    entry = fileURLToPath(new URL("./cli.mts", import.meta.url));
  const args = [
    "--conditions=react-server",
    "--import",
    root + "node_modules/tsx/dist/loader.mjs",
    entry,
  ];
  const run = (input: string) =>
    spawnSync(process.execPath, args, {
      cwd: root,
      input,
      encoding: "utf8",
      timeout: 15000,
      env: { PATH: "/usr/bin:/bin", NODE_ENV: "development" },
    });
  const cliFixture = fixture();
  cliFixture.pages[2].extraction = "unverified_ocr";
  cliFixture.catalog.sources[0].units.find(
    (u) => u.page_start === 3,
  )!.extraction = "unverified_ocr";
  const a = run(
    JSON.stringify({
      input: cliFixture,
      cases: [
        { id: "synthetic", query: "first step", source_ids: ["source1"] },
      ],
    }),
  );
  expect(a.status).toBe(0);
  expect(JSON.parse(a.stdout).cases[0]).toMatchObject({
    status: "candidate",
    all_section_pages_native: false,
    selected_unverified_ocr_units: 1,
  });
  expect(a.stdout).not.toContain("Observe a painted square");
  const b = run("{ private synthetic invalid JSON");
  expect(b.status).toBe(1);
  expect(JSON.parse(b.stdout)).toEqual({
    status: "failed",
    message: "Offline section control unavailable",
  });
  expect(b.stdout).not.toContain("private synthetic");
});

it.each([
  "STEP IIII\n\nUNCERTAIN TOPIC",
  "STEP III:",
  "STEP III —",
  "STEP V",
  "STEP III\n\n" + "X".repeat(121),
])(
  "blocks complete parents across an uncertain intervening marker: %s",
  (barrier) => {
    const index = buildOfflineSectionIndex(
      fixture(["STEP I\n\nTOPIC", barrier, "STEP II\n\nNEXT"]),
    );
    expect(query(index)).toMatchObject({
      status: "candidate",
      open_end: true,
      complete_section: false,
    });
    expect(
      prepareOfflineSectionParent(index, {
        query: "first step",
        source_ids: ["source1"],
      }).status,
    ).toBe("blocked");
  },
);
it("refuses an unresolved target heading", () => {
  expect(query(buildOfflineSectionIndex(fixture(["STEP I"]))).status).toBe(
    "ambiguous_heading",
  );
});
it("preserves interior OCR qualifications in source-free experiment results", async () => {
  const f = fixture();
  f.pages[2].extraction = "unverified_ocr";
  f.catalog.sources[0].units.find((u) => u.page_start === 3)!.extraction =
    "unverified_ocr";
  const r = await runOfflineSectionCases({
    input: f,
    cases: [{ id: "ocr", query: "first step", source_ids: ["source1"] }],
  });
  expect(r.cases[0]).toMatchObject({
    all_section_pages_native: false,
    selected_unverified_ocr_units: 1,
    parent: { status: "blocked" },
  });
});
it("reports oversized parent diagnostics without exposing its text", async () => {
  const r = await runOfflineSectionCases({
    input: fixture(["STEP I\n\nTOPIC", "x".repeat(16000), "STEP II\n\nNEXT"]),
    cases: [{ id: "large", query: "first step", source_ids: ["source1"] }],
  });
  expect(r.cases[0].parent.status).toBe("too_large");
});
