import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { $createParagraphNode, $createTextNode, $getRoot, ElementNode } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { fixture, audienceIncludes } from "./model.js";
import "./style.css";

class RitualTaskNode extends ElementNode {
  constructor(id = "", mode = "say", audience = { scope: "all", roles: [] }, key) {
    super(key);
    this.__ritualId = id;
    this.__mode = mode;
    this.__audience = audience;
  }
  static getType() { return "ritual-task"; }
  static clone(node) { return new RitualTaskNode(node.__ritualId, node.__mode, node.__audience, node.__key); }
  static importJSON(json) { return new RitualTaskNode(json.ritualId, json.mode, json.audience); }
  exportJSON() { return { ...super.exportJSON(), type: "ritual-task", version: 1, ritualId: this.__ritualId, mode: this.__mode, audience: this.__audience }; }
  createDOM() {
    const element = document.createElement("section");
    element.className = "task lexical-task";
    element.dataset.ritualId = this.__ritualId;
    element.dataset.label = `${this.__mode} · ${this.__audience.scope} ${(this.__audience.roles || []).join(",")}`;
    return element;
  }
  updateDOM(previous, dom) {
    if (previous.__mode !== this.__mode || previous.__audience !== this.__audience) {
      dom.dataset.label = `${this.__mode} · ${this.__audience.scope} ${(this.__audience.roles || []).join(",")}`;
    }
    return false;
  }
  collapseAtStart() { return true; }
}

function initialState() {
  const root = $getRoot();
  root.clear();
  for (const node of fixture.nodes.filter((entry) => entry.type === "task")) {
    const task = new RitualTaskNode(node.id, node.mode, node.audience);
    const paragraph = $createParagraphNode();
    paragraph.append($createTextNode(node.children[0].children.map((child) => child.text || (child.type === "variableRef" ? `{${child.name}}` : child.value || "")).join("")));
    task.append(paragraph);
    root.append(task);
  }
}

const initialConfig = {
  namespace: "magickli-lexical-boundary-trial",
  nodes: [RitualTaskNode],
  editorState: initialState,
  onError(error) { throw error; },
};

function InitialStateCapture({ onState }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => { onState(editor.getEditorState().toJSON()); }, [editor, onState]);
  return null;
}

function App() {
  const [json, setJson] = useState(null);
  const [role, setRole] = useState("hierophant");
  const tasks = json?.root?.children?.filter((node) => node.type === "ritual-task") || [];
  return <main>
    <header><h1>Lexical role-boundary spike</h1><p>Focused third-candidate check after Slate merged two different roles. Same synthetic task nodes; other constructs remain in the Slate/Tiptap trial.</p></header>
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin contentEditable={<ContentEditable aria-label="Lexical task editor" className="editor" />} placeholder={<p>Type a task…</p>} ErrorBoundary={LexicalErrorBoundary} />
      <HistoryPlugin />
      <OnChangePlugin onChange={(state) => setJson(state.toJSON())} />
      <InitialStateCapture onState={setJson} />
    </LexicalComposer>
    <section className="reader"><h2>Role-filtered task preview</h2><label>Reader role <select value={role} onChange={(event) => setRole(event.target.value)}>{["hierophant", "keryx", "candidate", "member"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <article>{tasks.filter((node) => audienceIncludes(node.audience, role, fixture.aliases)).map((node) => <section key={node.ritualId} className="reader-task" data-reader-id={node.ritualId}><b>{node.mode} · {node.audience.scope}</b><p>{node.children.map((child) => child.children?.map((leaf) => leaf.text).join("")).join(" ")}</p></section>)}</article>
    </section>
    <details><summary>Serialized Lexical editor state</summary><pre>{JSON.stringify(json, null, 2)}</pre></details>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
