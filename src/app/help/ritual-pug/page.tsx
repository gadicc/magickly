import Link from "@magick-components/Link";
import { Box, Container } from "@mui/material";
import { ritualPugExamples, ritualPugStarter } from "@/doc/ritualPugExamples";
import { pageMetadata } from "@/seo/metadata";

export const metadata = pageMetadata("/help/ritual-pug");
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

export default function RitualPugGuide() {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <h1>Ritual Pug guide</h1>
      <p>
        Ritual Pug is the source view of a structured ritual. The editor's
        switch offers Source, Split (both panels side by side) and Visual.
        Visual edits regenerate source; valid source edits update the visual
        panel after a short typing pause. Incomplete syntax keeps the last valid
        document visible.
      </p>
      <p>
        The initial layout is split, with source on the left and visual editing
        on the right; small screens stack the panels. Your last chosen layout is
        remembered in this browser for both new and existing rituals.
        Source-only recovery does not replace that preference.
      </p>
      <p>
        Choose <strong>Visual / Ritual Pug</strong> when creating a ritual.
        Older Ritual Text drafts are recovered and converted automatically when
        valid. Incomplete or conflicting buffers remain available to repair,
        apply or download; pending saves must resolve before conversion. Block
        IDs and annotations are preserved. Source Undo covers typing in the
        current view; visual regeneration, discarding source, and recovery
        conversion start a fresh source history.
      </p>
      <h2>Task settings in the visual editor</h2>
      <p>
        Hover over a speech or action card, or tab to its role heading, to
        reveal the settings cog. On touch screens the cog stays visible. The
        same form opens from <strong>Edit properties</strong> when a task is
        selected. Choose <strong>Say / Speech</strong> or{" "}
        <strong>Do / Action</strong>, then assign selected roles, everyone, or
        all officers. For a group, the role picker lists optional exceptions.
        Search by full name or shortcut, or enter a custom role key using
        letters and numbers, beginning with a letter. Roles declared in the
        ritual are included too.
      </p>
      <p>
        <strong>All officers</strong> retains the existing ritual convention: it
        excludes Candidate and Member, and includes Aspirant and custom roles.
        Apply updates the source and keeps the task’s body and ID; the role and
        speech/action change undo together. Cancel leaves the task unchanged.
      </p>
      <p>
        <strong>Delete task</strong> at the bottom of the cog removes the whole
        card immediately, independently of unfinished settings. Use the brief
        <strong> Undo</strong> notification or <kbd>Ctrl/Cmd+Z</kbd> to restore
        its contents and IDs. The notification stops offering Undo after a later
        edit; normal editor history remains available.
      </p>
      <p>
        Empty speech and action cards have a full clickable body line, marked
        <strong> Type speech…</strong> or <strong>Type an action…</strong>.
        Click that line to place the cursor and start typing. These hints are
        editor-only and are never included in saved source or reader output.
      </p>
      <h2>Visual typing commands</h2>
      <p>
        In a fresh, unformatted paragraph, type <code>/say hiero </code> or
        <code> /do keryx </code>. The final space creates a speech or action
        card and puts the cursor in its body so you can keep typing. Standard
        role keys and shortcuts match without case sensitivity; declared and
        already-used custom role keys keep their exact case. Unknown keys stay
        as text. Everyone and all officers use <code>all</code> and
        <code> all-officers</code>; edit more detailed assignments with the cog.
      </p>
      <p>
        Typing <code>/</code> opens a menu of Speech, Action, Note, Section
        title and Temple hall; an empty line shows the first four as a hint. Use
        arrow keys and Enter, or tap a choice. Speech and Action then ask for a
        role; typing a role straight after the slash, such as <code>/ker</code>,
        offers it directly. Enter on an empty last line of a speech or action
        leaves it. Escape dismisses the menu and keeps that paragraph literal.
        Undo or immediate Backspace restores the command after conversion.
        Pasted commands stay literal.
      </p>
      <p>
        A command in the final paragraph of a task creates a sibling card.
        Commands midway through a task, inside a list, or inside a note within a
        task stay literal. Collected footnotes outside tasks support the same
        commands and canonical undo history. Commands create ordinary tasks in
        source; they do not introduce a new saved format.
      </p>
      <p>
        Temple hall lists the Golden Dawn hall presets by grade, as does typing
        a grade straight after the slash, such as <code>/zel</code>, and the
        toolbar’s Insert… dialog. Each inserts a copy of the preset that the
        ritual then owns. A hall may stand at the top level or directly inside a
        note, summary, list item or to-do. The slash command replaces its line
        there, or follows a speech or action from its last line; elsewhere it is
        not offered. The toolbar puts the hall after the block holding the
        cursor, at the nearest place a hall may stand. For source, the{" "}
        <Link href="/gd/hall">temple hall editor</Link> copies a hall’s Pug
        without IDs, ready to paste at the top level; indent it to put the hall
        in a note.
      </p>
      <p>
        The temple hall editor works on one hall outside any ritual: start from
        a preset, edit it on the drawing or in its Pug, side by side if you
        like, with undo and redo. It keeps the hall as a draft in that browser
        only, shares it as a link that holds the hall itself, and exports it as
        SVG or PNG. To keep a hall with a ritual’s history, copy its Pug source
        into the ritual’s source, or insert a temple hall there and choose{" "}
        <strong>Edit hall</strong> to edit it in place. In the drawing, an
        officer or banner dragged along the dais or a banner row changes places
        (<kbd>Alt</kbd> and the arrow keys do the same; an Alt-drag places it
        freely), and an item, marker or officer dropped on an altar, platform or
        throne that takes it stands on it. The properties of what is selected
        stand beside the drawing where there is room, and otherwise at the foot
        of the screen, where they can be hidden and shown again. A hall with
        warnings shows how many beside <strong>Edit hall</strong>.
      </p>
      <h2>Finding and fixing errors</h2>
      <p>
        Source errors have red underlines and a marker beside their line number.
        Hover over either for details, or choose <strong>Go to error</strong>.
        <kbd>F8</kbd> jumps to an error; <kbd>Shift+F8</kbd> goes backwards.
        <strong> Problems</strong> opens the error list, also available with
        <kbd> Ctrl+Shift+M</kbd> (<kbd>Cmd+Shift+M</kbd> on Mac). A folded ID is
        revealed when you jump to its error. Where only the line is known, the
        editor underlines that line’s content. Errors clear when corrected.
        Problems in a temple hall, such as an unknown tag or attribute or a
        value out of range, are warnings: underlined in yellow and listed in
        Problems, they do not stop saving, and the hall still draws.
      </p>
      <h2>Starter</h2>
      <Example source={ritualPugStarter} />
      <h2>Basic syntax</h2>
      <ul>
        <li>
          Keep the first line exactly <code>//- magickli-ritual-pug 1</code>.
        </li>
        <li>
          Indent children with two spaces. Blank lines and <code>//-</code>{" "}
          comments are allowed.
        </li>
        <li>
          Put simple text after a tag. Use <code>#[…]</code> for inline tags.
        </li>
        <li>
          Attributes use JSON literals: double-quoted strings, numbers,
          true/false, arrays or objects. Expressions are not evaluated.
        </li>
        <li>
          A trailing <code>/</code> means a node has no child collection. A bare
          tag can have an empty collection or indented children.
        </li>
      </ul>
      <p>
        Author comments and blank separator lines are stored with the tree and
        survive visual edits, saving and syntax switches. They appear as small
        annotation items in the visual editor, and are omitted from the reader.
        Edit their wording in source. Blank lines within Pug literal text or
        between consecutive pipe-text lines keep Pug’s content whitespace
        behavior. Use <code>br/</code> for an explicit reader line break.
        Indentation and other formatting are regenerated consistently. Multiline
        comments may use a generated
        <code> ritualComment(value="…")/</code> wrapper for exact preservation.
        Includes, JavaScript, mixins, loops, raw HTML and arbitrary tags are
        unsupported.
      </p>
      <h2>Speech, actions and inline content</h2>
      <p>
        <code>Hiero: Welcome.</code> creates speech;{" "}
        <code>* Keryx Open the door.</code> creates an action. These shortcuts
        are the default generated spelling for tasks with inline content.
        Explicit <code>say(role="hiero")</code> and{" "}
        <code>do(role="keryx")</code> also work, and are used for more complex
        tasks. Roles can be comma-separated, <code>All</code>,
        <code>All-officers</code> or <code>All-except-hiero</code>.
      </p>
      <Example source={ritualPugExamples.inline} />
      <p>
        Generated shortcuts capitalize the first letter of each role. Lowercase
        initials work too: <code>Hiero:</code> and <code>hiero:</code> refer to
        the same role. Explicit <code>say(role="…")</code> and{" "}
        <code>do(role="…")</code> preserve the exact role spelling. Names of
        supported Pug tags, such as <code>note</code>, keep Pug’s colon
        expansion syntax; use explicit <code>say(role="note")</code> for a role
        with that name.
      </p>
      <p>
        Use <code>b</code>, <code>i</code> and{" "}
        <code>a(href="https://example.com")</code>
        for bold, italic and links. <code>br/</code> inserts a line break.
        Footnotes use <code>footnote</code> with child content and{" "}
        <code>footnotes/</code>
        for their collected reader output.
      </p>
      <h2>Structure</h2>
      <Example source={ritualPugExamples.structure} />
      <p>
        The separate Title field names the ritual in the list. A{" "}
        <code>title</code>
        tag creates a heading within the content. Lists use <code>ul</code> or
        <code>ol</code>, containing <code>li</code> items.
      </p>
      <h2>Variables, options and grades</h2>
      <Example source={ritualPugExamples.variables} />
      <p>
        In text, <code>{"${candidate}"}</code> inserts a variable and{" "}
        <code>0=0</code> a grade, as in the earlier Pug editor. Generated source
        adds their IDs, as <code>{"${candidate#…}"}</code> and{" "}
        <code>0=0#…</code>. A grade needs a space or punctuation other than a
        full stop on each side, so <code>3.1=2</code> stays text. To keep such
        text literal, write it as{" "}
        <code>{'#[ritualText(value="${candidate}")/]'}</code>; the editor does
        this itself for text that only looks like a shortcut. The{" "}
        <code>grade(grade="0=0")/</code> and <code>var(name="candidate")/</code>{" "}
        tags still work.
      </p>
      <h2>Images</h2>
      <p>
        Use the visual editor’s Image control after saving a new ritual. It
        supplies an authorized image URL. Replace the example URL below;{" "}
        <code>alt</code>
        describes the image for readers who cannot see it.
      </p>
      <Example source={ritualPugExamples.image} />
      <h2>IDs and exact preservation</h2>
      <p>
        Canonical source includes <code>#id</code>, for example
        <code> Hiero#Ab3k9Qp7Zx2Mn5Rs: Welcome.</code> IDs are folded into small{" "}
        <code>#…</code> markers by default. Click one to reveal it, or choose{" "}
        <strong>Show IDs</strong>. Copying source and downloading drafts include
        the complete IDs. Existing UUID IDs are valid too.
      </p>
      <p>
        Keep IDs when editing or moving existing blocks. New tags can omit IDs;
        the editor assigns them. When copying source to create different blocks,
        remove the copied IDs. Visual copy/paste handles this automatically.
      </p>
      <p>
        <code>ritualText</code> preserves exact text and boundaries when
        ordinary Pug text would change whitespace. <code>ritualLegacy</code>{" "}
        preserves opaque content. Keep these generated payloads intact.
      </p>
      <Example source={ritualPugExamples.exact} />
      <p>
        Some valid structures require source editing. Their content remains
        intact. Original Pug revisions stay in history; the new projection is
        generated from the retained reader/semantic tree rather than replacing
        it with backup text.
      </p>
      <p>
        <Link href="/gd/rituals">Back to rituals</Link>
      </p>
    </Container>
  );
}
