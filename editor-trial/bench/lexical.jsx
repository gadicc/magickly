import React from "react";
import { createRoot } from "react-dom/client";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";

function App() {
  return <LexicalComposer initialConfig={{ namespace: "size-sample", onError: (error) => { throw error; } }}>
    <RichTextPlugin contentEditable={<ContentEditable aria-label="Lexical size sample" />} ErrorBoundary={LexicalErrorBoundary} />
    <HistoryPlugin />
  </LexicalComposer>;
}
createRoot(document.getElementById("root")).render(<App />);
