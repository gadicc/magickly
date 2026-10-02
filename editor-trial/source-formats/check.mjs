import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidates, pug, compact, directives } from "./codecs.mjs";
import { semanticFromJrt } from "../../src/doc/semantic.ts";
import { fixture, literalFixture } from "./fixture.mjs";

for (const [name, codec] of Object.entries(candidates)) {
  test(`${name}: preserves tree, IDs, attributes and a stable printed form`, () => {
    const source = codec.print(fixture);
    assert.deepEqual(codec.parse(source), fixture);
    assert.equal(codec.print(codec.parse(source)), source);
  });
  test(`${name}: preserves awkward literal text`, () => {
    for (const value of [
      "",
      " ",
      "  leading and trailing  ",
      "\n",
      "a\nb\n",
      "a\r\nb",
      "\tTab",
      "#{variable}",
      "#[b interpolation]",
      "!{raw}",
      "\\#{escaped}",
      ":::close",
      "* action",
      "Hiero: literal speech",
      '= "quoted"',
      "Hebrew שלום 🜁",
      'slashes \\ "quotes"',
    ]) {
      const doc = literalFixture(value);
      assert.deepEqual(codec.parse(codec.print(doc)), doc);
    }
  });
  test(`${name}: distinguishes absent children, empty children and adjacent text nodes`, () => {
    const doc = literalFixture("first");
    doc.nodes.push({
      kind: "element",
      id: "01995000-0000-7000-8000-999999999991",
      tag: "note",
      attrs: {},
    });
    doc.nodes.push({
      kind: "element",
      id: "01995000-0000-7000-8000-999999999992",
      tag: "note",
      attrs: {},
      children: [],
    });
    doc.nodes[0].children.push(
      { kind: "text", text: "second" },
      { kind: "text", text: "" },
    );
    assert.deepEqual(codec.parse(codec.print(doc)), doc);
  });
  test(`${name}: a text edit retains structural identities`, () => {
    const changed = codec.parse(
      codec.print(fixture).replace("Welcome.", "Greetings."),
    );
    const expected = structuredClone(fixture);
    expected.nodes[3].children[0].text = "Greetings.";
    assert.deepEqual(changed, expected);
  });
}
test("Pug expressions and arbitrary template constructs are refused without execution", () => {
  for (const input of [
    'note(nodeId="01995000-0000-7000-8000-999999999991", x=process.exit())',
    "- process.exit()",
    "include /tmp/file",
    "| #{process.exit()}",
  ])
    assert.throws(() => pug.parse("//- semantic-pug-trial 1\n" + input));
});
test("compact attribute delimiter inside a quoted value remains literal", () => {
  const doc = literalFixture("Text");
  doc.nodes[0].tag = "summary";
  doc.nodes[0].attrs = { summary: 'Preparation | caution: "]"' };
  assert.deepEqual(compact.parse(compact.print(doc)), doc);
});
test("unclosed and mismatched directives are refused", () => {
  const source = directives.print(fixture);
  assert.throws(() => directives.parse(source.replace("  :::\n", "::: \n")));
  assert.throws(() => directives.parse(source.replace(":::\n", "")));
});

for (const [name, codec] of Object.entries(candidates)) {
  test(`${name}: covers every supported tag, attributes and inline boundaries`, () => {
    const text = (value) => ({ type: "text", value });
    const jrt = {
      children: [
        {
          type: "title",
          text: "{literal title}",
          children: [text("{literal title}")],
        },
        {
          type: "declareVar",
          name: "choice",
          varType: "select",
          collapsable: false,
          children: [{ type: "option", value: "a", label: "A", children: [] }],
        },
        {
          type: "summary",
          summary: 'colon: and | quote "',
          children: [
            {
              type: "note",
              children: [
                text(""),
                { type: "b", children: [text("bold]")] },
                text(""),
                { type: "i", children: [text("italic")] },
                {
                  type: "a",
                  href: "https://example.test/?x=a&b=c",
                  children: [text("link")],
                },
                { type: "grade", grade: "0=0" },
                { type: "var", name: "choice" },
                { type: "br" },
                text("adjacent"),
                text("text"),
                { type: "footnote", children: [text("footnote")] },
              ],
            },
          ],
        },
        {
          type: "task",
          role: "all-officers-except-keryx,hiero",
          do: true,
          children: [{ type: "todo", children: [text("todo")] }],
        },
        { type: "footnotes", children: [] },
        { type: "hr" },
        {
          type: "ol",
          children: [{ type: "li", children: [text("numbered")] }],
        },
        { type: "ul", children: [{ type: "li", children: [text("bullet")] }] },
        {
          type: "img",
          src: "/synthetic.png",
          width: "300px",
          height: 10,
          style: '{"maxWidth":"100%"}',
        },
        {
          type: "unknown",
          data: {
            "expression-looking": "process.exit()",
            nested: [true, false, null, 3],
          },
        },
      ],
    };
    const doc = semanticFromJrt(jrt);
    assert.deepEqual(codec.parse(codec.print(doc)), doc);
  });
}

test("Pug literal punctuation cannot escape a generated inline node boundary", () => {
  for (const value of [
    "a\\",
    "\\",
    "[",
    "]",
    "a[",
    "#",
    "!",
    'quote "',
    "\u2028",
  ]) {
    const doc = literalFixture(value);
    doc.nodes[0].children.push({
      kind: "element",
      id: "01995000-0000-7000-8000-999999999991",
      tag: "b",
      attrs: {},
      children: [{ kind: "text", text: value }],
    });
    assert.deepEqual(pug.parse(pug.print(doc)), doc);
  }
});
test("malformed private corpus failures never reveal an input excerpt", async () => {
  const root = await mkdtemp(join(tmpdir(), "magickli-format-privacy-"));
  const marker = "SYNTHETIC_PRIVATE_FAILURE_MARKER";
  try {
    const hash = (value) => createHash("sha256").update(value).digest("hex");
    const malformed = `{ "private": "${marker}", invalid }`;
    const corpus = {
      profile: "magickli-private-ritual-corpus-v1",
      rituals: [
        {
          source: "source",
          sourceSha256: hash("source"),
          contentJson: malformed,
          contentSha256: hash(malformed),
        },
      ],
    };
    for (const value of [malformed, JSON.stringify(corpus)]) {
      const path = join(root, "corpus.json");
      await writeFile(path, value, { mode: 0o600 });
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "editor-trial/source-formats/measure.mjs", path],
        { encoding: "utf8", env },
      );
      assert.equal(result.status, 1);
      assert.equal(result.stdout.includes(marker), false);
      assert.equal(result.stderr.includes(marker), false);
      assert.match(result.stderr, /^Source-format measurement failed;/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("literal Pug wrappers refuse nested programs instead of discarding their AST", () => {
  for (const wrapper of [
    'ritualText(value="safe")/',
    'ritualLegacy(nodeId="01995000-0000-7000-8000-999999999991", raw={"type":"unknown"})/',
  ])
    assert.throws(() =>
      pug.parse(
        "//- semantic-pug-trial 1\n" + wrapper + "\n  - process.exit()",
      ),
    );
});
test("directive content cannot enter a block after its closing marker", () => {
  const source =
    '<!-- ritual-directive-trial 1 -->\n:::note~01995000-0000-7000-8000-999999999991\n  = "inside"\n:::\n  = "outside"\n';
  assert.throws(() => directives.parse(source));
});
