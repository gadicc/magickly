import React from "react";
import { createRoot } from "react-dom/client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

function App() {
  const editor = useEditor({ extensions: [StarterKit], content: "<p>Basic editor</p>", immediatelyRender: false });
  return <EditorContent editor={editor} aria-label="Tiptap size sample" />;
}
createRoot(document.getElementById("root")).render(<App />);
