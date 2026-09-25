import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorContent, useEditor } from "@tiptap/react";
import { semanticFromJrt, semanticToJrt } from "../../src/doc/semantic.ts";
import { ritualTiptapExtensions, semanticFromTiptap, semanticToTiptap } from "../../src/doc/tiptapRitual.ts";

const initial = semanticFromJrt({ children: [
  { type: "task", say: true, role: "hiero", children: [{ type: "text", value: "First audience." }] },
  { type: "task", say: true, role: "keryx", children: [{ type: "text", value: "Second audience." }] },
  { type: "note", children: [{ type: "text", value: "שלום עולם" }] },
] });

function App() {
  const [output, setOutput] = useState(initial);
  const [error, setError] = useState("");
  const editor = useEditor({
    extensions: ritualTiptapExtensions,
    content: semanticToTiptap(initial),
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": "Production ritual schema editor" } },
    onUpdate({ editor }) {
      try { setOutput(semanticFromTiptap(editor.getJSON())); setError(""); }
      catch (cause) { setError(String(cause)); }
    },
  });
  return <main>
    <h1>Production ritual adapter trial</h1>
    <p>Place the caret at the start of the second speech and press Backspace. The two audiences must remain distinct.</p>
    <EditorContent editor={editor} className="editor" />
    <p role="status">{error || `Tasks: ${output.nodes.filter((node) => node.kind === "element" && node.tag === "task").length}`}</p>
    <pre aria-label="Reader JSON">{JSON.stringify(semanticToJrt(output), null, 2)}</pre>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
