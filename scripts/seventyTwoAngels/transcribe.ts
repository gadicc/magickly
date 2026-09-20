import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { type PageTranscription, pageTranscription } from "./pageSchema";
import { pageImage } from "./pages";

/**
 * Reads Lenain's pages from the scan itself.
 *
 * The sidecar in public/docs was OCR'd from the same scan and lost what this
 * recovers: the Hebrew, which it rendered as scrambled Latin; the digits,
 * which it read as letters; the first cabalistic table, which it kept only the
 * last ten rows of; and the twenty-second genius's heading, which it dropped
 * at a page break. At 200 dpi all of it is plainly legible. See plan 031.
 *
 *   pnpm exec loom env -- pnpm exec tsx scripts/seventyTwoAngels/transcribe.ts
 *   … --from 62 --to 113     the genii chapter, which is the default
 *   … --force                read pages already done again
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
const CONCURRENCY = 4;
const OUT_DIR = "output/lenainPages";

/** The chapter on the 72 genii, printed pages 45 to 97. */
const CHAPTER_FROM = 61;
const CHAPTER_TO = 113;

const INSTRUCTIONS = `You are transcribing one page of Lazare Lenain's "La Science \
Cabalistique" (Angers, 1823). Lenain died in 1832, so the work is public domain. You \
are given a photograph of the page. Read it.

Transcribe what is printed, exactly. Do not modernise Lenain's spelling, correct his \
grammar, or fix his arithmetic — where he prints an impossible date such as "31 avril", \
transcribe "31 avril". You are making a record of the page, not an improved version of \
it.

- Rejoin words the typesetter broke across lines: "do-" and "mine" are "domine". Do not \
join words that are merely at a line end without a hyphen.
- Hebrew: give the actual Hebrew letters, right to left as printed. This is the whole \
reason for reading the page rather than its OCR, so take care over it. If a letter is \
genuinely illegible, say so in "uncertain" rather than guessing.
- Each paragraph is its own block. Keep Lenain's paragraphing; do not merge or split.
- A paragraph does not end because something interrupted it. The rule above the \
footnotes cuts across the page, and the page itself ends mid-sentence; in both cases \
the paragraph carries on. Give the continuation as its own block with \
"continuesPrevious" true, so the two can be rejoined — and if the break falls inside a \
hyphenated word, leave the hyphen on the first part so the join can be made. Everything \
else has "continuesPrevious" false.
- Footnotes are printed below a rule at the foot of the page. They are their own \
blocks, of kind "footnote", with their number in "marker" — "1", "2" — and the call \
stays inline in the paragraph where it appears. A footnote is often long and often \
looks like ordinary prose: what makes it a footnote is that it sits below the rule, not \
what it says. Do not let one become a paragraph.
- Tables are blocks of kind "table", with their contents in "rows" — one array per row, \
one string per cell — and "text" left empty. Preserve the columns as printed, including \
empty cells. Do not flatten a table into prose.
- Page numbers, running heads, signature marks, catchwords and the "Digitized by \
Google" watermark are blocks of kind "furniture". Include them, so nothing on the page \
is silently dropped, but keep them out of the body blocks.
- "printedPage" is the number printed on the page, which is not the page of the PDF. \
Use 0 if the page carries no number.
- "marker" is empty and "continuesPrevious" is false for anything that is neither a \
footnote nor a continuation.

Put anything illegible or doubtful in "uncertain". An empty array is a claim that the \
page came through cleanly.`;

function pathFor(page: number) {
  return join(OUT_DIR, `p-${String(page).padStart(3, "0")}.json`);
}

export function readPage(page: number): PageTranscription {
  return pageTranscription.parse(
    JSON.parse(readFileSync(pathFor(page), "utf8")),
  );
}

async function transcribeOne(page: number, model: string) {
  const { object } = await generateObject({
    model,
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    maxOutputTokens: 16000,
    schema: pageTranscription,
    system: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `This is page ${page} of the PDF.` },
          { type: "image", image: pageImage(page) },
        ],
      },
    ],
  });
  return { ...object, pdfPage: page };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : Number(args[at + 1]);
  };
  const force = args.includes("--force");
  const modelAt = args.indexOf("--model");
  const model = modelAt < 0 ? DEFAULT_MODEL : args[modelAt + 1];
  const from = value("--from") ?? CHAPTER_FROM;
  const to = value("--to") ?? CHAPTER_TO;

  mkdirSync(OUT_DIR, { recursive: true });
  const todo = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(
    (page) => force || !existsSync(pathFor(page)),
  );
  if (!todo.length) return console.log("Nothing to transcribe.");
  console.log(`Reading ${todo.length} pages (${from}-${to}) with ${model}.`);

  const queue = [...todo];
  const failures: string[] = [];
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let page = queue.shift(); page; page = queue.shift()) {
        try {
          const transcription = await transcribeOne(page, model);
          writeFileSync(
            pathFor(page),
            `${JSON.stringify({ ...transcription, _model: model }, null, 2)}\n`,
          );
          done++;
          const hebrew = JSON.stringify(transcription.blocks).match(
            /[֐-׿]/g,
          )?.length;
          console.log(
            `[${done}/${todo.length}] pdf ${page} = printed ${transcription.printedPage}` +
              `, ${transcription.blocks.length} blocks` +
              `${hebrew ? `, ${hebrew} Hebrew letters` : ""}` +
              `${transcription.uncertain.length ? ` ⚠ ${transcription.uncertain.length}` : ""}`,
          );
        } catch (error) {
          const why = error instanceof Error ? error.message : String(error);
          failures.push(`${page}: ${why}`);
          console.error(`[!] page ${page} failed: ${why}`);
        }
      }
    }),
  );

  if (failures.length) {
    console.error(`\n${failures.length} failed:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

// The package is CommonJS, so this runs main rather than awaiting it.
if (process.argv[1]?.endsWith("transcribe.ts"))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
