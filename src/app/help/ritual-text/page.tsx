import Link from "@magick-components/Link";
import { Box, Container } from "@mui/material";
import type { Metadata } from "next";
import {
  ritualTextExamples,
  ritualTextStarter,
} from "@/doc/ritualTextExamples";

export const metadata: Metadata = {
  title: "Ritual Text guide",
  description:
    "Write rituals with speech, actions, notes, variables and rich text.",
};

function Example({ source }: { source: string }) {
  return (
    <Box
      component="pre"
      sx={{ overflowX: "auto", p: 2, bgcolor: "action.hover", borderRadius: 1 }}
    >
      <code>{source}</code>
    </Box>
  );
}

export default function RitualTextGuide() {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <h1>Ritual Text guide</h1>
      <p>
        This guide covers the earlier source syntax, still available for
        existing drafts and source editing. New rituals use{" "}
        <Link href="/help/ritual-pug">Ritual Pug</Link>.
      </p>
      <p>
        Ritual Text is Magickly’s custom source format for visual ritual
        editing. It describes speech, actions, rich text and ritual controls.
        The editor saves a structured ritual document and gives you this
        readable text view of it. Pug remains available for existing source and
        legacy workflows.
      </p>
      <p>
        Choose <strong>Ritual Text</strong> in the source syntax selector of an
        existing ritual. In <strong>split</strong> mode, the editor shows source
        on the left and the editable visual panel on the right. Visual edits
        update source immediately; valid source edits update the visual panel
        after a short typing pause. Incomplete syntax keeps the last valid
        preview visible and pauses visual editing until corrected. If both
        panels have changed, resolve the warning by applying or discarding your
        source edits.
      </p>
      <nav aria-label="Guide sections">
        <p>
          <a href="#starter">Starter</a> · <a href="#syntax">Basic syntax</a> ·{" "}
          <a href="#roles">Speech and actions</a> ·{" "}
          <a href="#structure">Structure and formatting</a> ·{" "}
          <a href="#variables">Variables</a> · <a href="#images">Images</a> ·{" "}
          <a href="#identities">IDs and legacy content</a>
        </p>
      </nav>
      <h2 id="starter">Start here</h2>
      <p>
        This editable example uses the earlier syntax. Replace the words, rename
        the sections, and delete anything you do not need. The separate Title
        field names the ritual in the list; <code>@title</code> is a heading
        inside its content.
      </p>
      <Example source={ritualTextStarter} />
      <h2 id="syntax">Basic syntax</h2>
      <ul>
        <li>
          The first line must be exactly <code>ritual 1</code>.
        </li>
        <li>Blank lines are allowed. There is no comment syntax.</li>
        <li>
          Use two spaces for each nesting level, with no tabs. A command ending
          in <code>:</code> opens a group of indented child lines.
        </li>
        <li>
          <code>= "text"</code> is a text fragment. Quoted values use JSON
          escaping: <code>{String.raw`\"`}</code> for a quote,{" "}
          <code>{"\\n"}</code> for a newline, and <code>{"\\\\"}</code> for a
          backslash. Keep each command on one source line.
        </li>
        <li>
          Commands begin with <code>@</code>. General commands can include a
          JSON object of attributes, followed by <code>:</code> if they have
          children. Attribute names and strings need double quotes.
        </li>
      </ul>
      <p>
        Markdown and HTML markup have no special meaning here. Use ritual
        commands for formatting; typing <code>**bold**</code> inside text leaves
        those asterisks in the text.
      </p>
      <Example source={ritualTextExamples.text} />
      <h2 id="roles">Speech and actions</h2>
      <p>
        <code>Role: words</code> creates speech, and <code>* Role action</code>
        creates an action. Their text runs to the end of the line and does not
        need quotes. Shortcuts normalize the role to lowercase. You can use
        roles such as <code>hiero</code>, <code>keryx</code>, <code>all</code>,
        <code> all-officers</code>, comma-separated roles, or
        <code> all-except-hiero</code>. The explicit <code>@say</code> and
        <code> @do</code> forms use quoted text.
      </p>
      <Example source={ritualTextExamples.roles} />
      <p>
        For formatted speech or variables within speech, use
        <code>{' @task {"say":true,"role":"hiero"}:'}</code> with indented
        children. For an action, use <code>"do":true</code> instead of
        <code> "say":true</code>.
      </p>
      <h2 id="structure">Structure and formatting</h2>
      <p>
        <code>@title "Heading"</code> creates a title. A collapsible section
        uses
        <code> @summary "Section name":</code> with its content indented below.
        Notes use <code>@note:</code>. For inline bold, italic and links, nest
        fragments below <code>@b:</code>, <code>@i:</code> and <code>@a</code>.
        Use <code>@br</code> for a line break and <code>@hr</code> for a
        divider.
      </p>
      <Example source={ritualTextExamples.formatting} />
      <p>
        Lists use <code>@ul:</code> or <code>@ol:</code>, with <code>@li:</code>
        items. Adjacent text and inline commands form a run of text; a newline
        in the source alone does not create a visible line break. The visual
        editor supports common shapes. If a valid source shape cannot be
        represented faithfully there, it explains the limitation and keeps
        source editing available.
      </p>
      <h3>Notes and footnotes</h3>
      <p>
        <code>@todo:</code> marks work to do. <code>@footnote:</code> contains a
        reference, and <code>@footnotes</code> marks where collected footnotes
        should appear in the reader.
      </p>
      <Example source={ritualTextExamples.notes} />
      <h2 id="variables">Variables, options and grades</h2>
      <p>
        Declare a reader input with <code>@declareVar</code>. Text inputs use
        <code> "varType":"text"</code>; select inputs use
        <code> "varType":"select"</code> and child <code>@option</code>
        commands. Insert its value with <code>@var name</code>, and a grade
        label with <code>@grade 0=0</code>. For names containing spaces or
        punctuation, use <code>{'@var {"name":"candidate name"}'}</code>.
      </p>
      <Example source={ritualTextExamples.variables} />
      <h2 id="images">Images</h2>
      <p>
        In a saved ritual, use the visual editor’s Image control to upload or
        choose an image. It supplies the source URL. Replace the example URL
        below with your image’s URL; <code>alt</code> describes it for readers
        who cannot see it. Image uploads become available after creation.
      </p>
      <Example source={ritualTextExamples.image} />
      <h2 id="identities">IDs, legacy content and errors</h2>
      <p>
        The editor prints stable IDs after commands, for example
        <code> @note~01995000-0000-7000-8000-000000000001:</code>. Keep those
        IDs when editing existing nodes. New commands may omit the ID; the
        editor creates one. When copying a block to make a new block, remove its
        IDs so the copies have different identities.
      </p>
      <p>
        Converted rituals can contain lines starting with <code>?~</code>. These
        preserve legacy content that the visual editor cannot safely interpret.
        Keep the full payload intact. The editor shows conversion warnings; the
        original Pug revision stays in history. Open the Pug editor when
        conversion is unavailable.
      </p>
      <p>
        Errors identify a line or invalid attribute. Check indentation, quotes,
        colons and role names. Supported commands are <code>@a</code>,
        <code> @b</code>, <code>@br</code>, <code>@declareVar</code>,
        <code> @footnote</code>, <code>@footnotes</code>, <code>@grade</code>,
        <code> @hr</code>, <code>@i</code>, <code>@img</code>, <code>@li</code>,
        <code> @note</code>, <code>@ol</code>, <code>@option</code>,
        <code> @summary</code>, <code>@task</code>, <code>@title</code>,
        <code> @todo</code>, <code>@ul</code> and <code>@var</code>, plus
        <code> @say</code> and <code>@do</code> shortcuts. Arbitrary HTML tags,
        scripts and tables are not supported by this format.
      </p>
      <p>
        <Link href="/gd/rituals">Back to rituals</Link>
      </p>
    </Container>
  );
}
