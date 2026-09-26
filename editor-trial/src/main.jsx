import React, { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEditor, Editor, Element, Node as SlateNode, Transforms } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, useSlate, useSlateSelection, withReact } from "slate-react";
import { EditorContent, useEditor } from "@tiptap/react";
import { fixture, longDocument, validate } from "./model.js";
import Reader from "./Reader.jsx";
import { fromSlate, fromTiptap, newTask, toSlate, toTiptap } from "./adapters.js";
import { extensions } from "./tiptap.js";
import "./style.css";

const storeKey = "magickli-editor-trial-v1";
const uid = () => crypto.randomUUID();
const newParagraph = (message) => ({ id: uid(), type: "paragraph", children: [{ type: "text", text: message }] });

function SlateElement({ attributes, children, element }) {
  const extra = { ...attributes, "data-node-id": element.id };
  if (element.type === "heading") return React.createElement(`h${element.level}`, { ...extra, id: element.anchor }, children);
  if (element.type === "paragraph") return <p {...extra}>{children}</p>;
  if (element.type === "task") return <section {...extra} className="task"><div contentEditable={false} className="task-label">{element.mode} · {element.audience.scope} {element.audience.roles?.join(", ")}</div>{children}</section>;
  if (element.type === "note") return <aside {...extra} className="note">{children}</aside>;
  if (element.type === "summary") return <div {...extra} className="summary"><div contentEditable={false} className="task-label">Summary: {element.label}</div>{children}</div>;
  if (element.type === "footnote") return <aside {...extra} className="footnote"><div contentEditable={false} className="task-label">Footnote</div>{children}</aside>;
  if (element.type === "variableRef") return <span {...extra} contentEditable={false} className="atom variableRef">{`{${element.name}}`}{children}</span>;
  if (element.type === "grade") return <span {...extra} contentEditable={false} className="atom grade">{element.value}{children}</span>;
  if (element.type === "declaration") return <div {...extra} contentEditable={false} className="atom">Variable: {element.label} ({element.input}){children}</div>;
  if (element.type === "image") return <div {...extra} contentEditable={false} className="atom">Image: {element.alt} · {element.src}{children}</div>;
  if (element.type === "legacy") return <div {...extra} contentEditable={false} className="atom legacy">Unsupported legacy source: {element.source}{children}</div>;
  return <p {...extra}>{children}</p>;
}

function SlateToolbar() {
  const editor = useSlate();
  useSlateSelection();
  const [taskPath, setTaskPath] = useState(null);
  const insert = (node) => Transforms.insertNodes(editor, node);
  const selectedTopLevel = () => editor.selection?.anchor.path?.[0];
  const selectedTask = () => Editor.above(editor, { match: (node) => Element.isElement(node) && node.type === "task" });
  const taskEntry = taskPath ? Editor.node(editor, taskPath) : null;
  const move = (direction) => {
    const index = selectedTopLevel(); if (index === undefined) return;
    const target = index + direction;
    if (target < 0 || target >= editor.children.length) return;
    Transforms.moveNodes(editor, { at: [index], to: [target] });
  };
  return <div className="toolbar">
    <button onMouseDown={(e) => { e.preventDefault(); insert(toSlate({ nodes: [newTask("say")] })[0]); }}>Insert speech</button>
    <button onMouseDown={(e) => { e.preventDefault(); insert(toSlate({ nodes: [newTask("do")] })[0]); }}>Insert action</button>
    <button onMouseDown={(e) => { e.preventDefault(); insert({ id: uid(), type: "note", children: [toSlate({ nodes: [newParagraph("New note")] })[0]] }); }}>Insert note</button>
    <button onMouseDown={(e) => { e.preventDefault(); insert({ type: "variableRef", name: "candidateName", children: [{ text: "" }] }); }}>Insert variable</button>
    <button onMouseDown={(e) => { e.preventDefault(); insert({ type: "grade", value: "1=10", children: [{ text: "" }] }); }}>Insert grade</button>
    <button onMouseDown={(e) => { e.preventDefault(); const name = `newVariable${Math.floor(Math.random() * 100000)}`; insert({ id: uid(), type: "declaration", name, label: "New variable", input: "text", default: "Value", options: [], children: [{ text: "" }] }); }}>Insert variable declaration</button>
    <button onMouseDown={(e) => { e.preventDefault(); move(-1); }}>Move up</button>
    <button onMouseDown={(e) => { e.preventDefault(); move(1); }}>Move down</button>
    <button onMouseDown={(e) => { e.preventDefault(); const index = selectedTopLevel(); if (index !== undefined) Transforms.removeNodes(editor, { at: [index] }); }}>Delete node</button>
    <button onMouseDown={(e) => { e.preventDefault(); editor.undo(); }}>Undo</button>
    <button onMouseDown={(e) => { e.preventDefault(); editor.redo(); }}>Redo</button>
    <button onMouseDown={(e) => { e.preventDefault(); setTaskPath(selectedTask()?.[1] || null); }}>Edit selected task</button>
    {taskEntry && <label>Selected task audience
      <select value={taskEntry[0].audience.scope} onChange={(e) => Transforms.setNodes(editor, { audience: { ...taskEntry[0].audience, scope: e.target.value } }, { at: taskPath })}>
        {["all", "roles", "officers", "except", "officersExcept"].map((value) => <option key={value}>{value}</option>)}
      </select>
      <input key={taskEntry[0].id} aria-label="Audience roles, comma separated" defaultValue={taskEntry[0].audience.roles?.join(",") || ""} onBlur={(e) => Transforms.setNodes(editor, { audience: { ...taskEntry[0].audience, roles: e.target.value.split(",").map((role) => role.trim()).filter(Boolean) } }, { at: taskPath })} />
    </label>}
  </div>;
}

function SlateSpike({ document, onDocument }) {
  const editor = useMemo(() => {
    const instance = withHistory(withReact(createEditor()));
    const inline = instance.isInline, voidNode = instance.isVoid;
    instance.isInline = (node) => ["variableRef", "grade"].includes(node.type) || inline(node);
    instance.isVoid = (node) => ["variableRef", "grade", "declaration", "image", "legacy"].includes(node.type) || voidNode(node);
    return instance;
  }, []);
  const renderElement = useCallback((props) => <SlateElement {...props} />, []);
  const renderLeaf = useCallback(({ attributes, children, leaf }) => <span {...attributes} lang={leaf.lang} dir={leaf.dir} style={{ fontWeight: leaf.marks?.includes("bold") ? "bold" : undefined, fontStyle: leaf.marks?.includes("italic") ? "italic" : undefined }}>{children}</span>, []);
  return <Slate editor={editor} initialValue={toSlate(document)} onChange={(nodes) => {
    if (editor.operations.some((operation) => operation.type !== "set_selection")) onDocument(fromSlate(nodes, document));
  }}>
    <SlateToolbar />
    <Editable aria-label="Slate ritual editor" className="editor" renderElement={renderElement} renderLeaf={renderLeaf} spellCheck />
  </Slate>;
}

function TiptapSpike({ document, onDocument }) {
  const [, rerender] = useState(0);
  const editor = useEditor({
    extensions,
    content: toTiptap(document),
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Tiptap ritual editor", "aria-multiline": "true" } },
    onUpdate({ editor }) { onDocument(fromTiptap(editor.getJSON(), document)); },
    onSelectionUpdate() { rerender((value) => value + 1); },
  });
  if (!editor) return <p>Loading Tiptap…</p>;
  const insert = (node) => editor.chain().focus().insertContent(toTiptap({ nodes: [node] }).content[0]).run();
  const task = (() => {
    const position = editor.state.selection.$from;
    for (let depth = position.depth; depth > 0; depth--) if (position.node(depth).type.name === "task") return { node: position.node(depth), pos: position.before(depth) };
    return null;
  })();
  const updateTask = (attrs) => {
    if (!task) return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(task.pos, undefined, { ...task.node.attrs, ...attrs }));
  };
  const topBlock = () => {
    const index = editor.state.selection.$from.index(0);
    const node = editor.state.doc.child(index);
    let pos = 0;
    for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
    return { index, node, pos };
  };
  const moveTop = (direction) => {
    const { index, node, pos } = topBlock();
    const target = index + direction;
    if (target < 0 || target >= editor.state.doc.childCount) return;
    const sibling = editor.state.doc.child(target);
    const insertAt = direction < 0 ? pos - sibling.nodeSize : pos + sibling.nodeSize;
    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize).insert(insertAt, node));
  };
  return <>
    <div className="toolbar">
      <button onClick={() => insert(newTask("say"))}>Insert speech</button>
      <button onClick={() => insert(newTask("do"))}>Insert action</button>
      <button onClick={() => insert({ id: uid(), type: "note", children: [newParagraph("New note")] })}>Insert note</button>
      <button onClick={() => insert({ type: "variableRef", name: "candidateName" })}>Insert variable</button>
      <button onClick={() => insert({ type: "grade", value: "1=10" })}>Insert grade</button>
      <button onClick={() => { const name = `newVariable${Math.floor(Math.random() * 100000)}`; insert({ id: uid(), type: "declaration", name, label: "New variable", input: "text", default: "Value", options: [] }); }}>Insert variable declaration</button>
      <button onClick={() => moveTop(-1)}>Move up</button>
      <button onClick={() => moveTop(1)}>Move down</button>
      <button onClick={() => { const { node, pos } = topBlock(); editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize)); }}>Delete node</button>
      <button onClick={() => editor.chain().focus().undo().run()}>Undo</button>
      <button onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      {task && <label>Selected task audience
        <select value={task.node.attrs.audience.scope} onChange={(e) => updateTask({ audience: { ...task.node.attrs.audience, scope: e.target.value } })}>
          {["all", "roles", "officers", "except", "officersExcept"].map((value) => <option key={value}>{value}</option>)}
        </select>
        <input aria-label="Audience roles, comma separated" defaultValue={task.node.attrs.audience.roles?.join(",") || ""} onBlur={(e) => updateTask({ audience: { ...task.node.attrs.audience, roles: e.target.value.split(",").map((role) => role.trim()).filter(Boolean) } })} />
      </label>}
    </div>
    <EditorContent editor={editor} className="editor" />
  </>;
}

function App() {
  const [document, setDocument] = useState(fixture);
  const [engine, setEngine] = useState("slate");
  const [mode, setMode] = useState("wysiwyg");
  const [generation, setGeneration] = useState(0);
  const [source, setSource] = useState(JSON.stringify(fixture, null, 2));
  const [message, setMessage] = useState("");
  const [timing, setTiming] = useState(null);
  const [showReader, setShowReader] = useState(true);
  const reset = (next) => { setDocument(next); setGeneration((value) => value + 1); setSource(JSON.stringify(next, null, 2)); setMessage(""); };
  const switchMode = (next) => { if (next === "source") setSource(JSON.stringify(document, null, 2)); setMode(next); };
  const applySource = () => {
    try {
      const next = JSON.parse(source);
      const errors = validate(next);
      if (errors.length) { setMessage(errors.join("; ")); return; }
      reset(next); setMode("wysiwyg");
    } catch (error) { setMessage(error.message); }
  };
  return <main>
    <header><h1>Magickli ritual editor trial</h1><p>Synthetic data only · local browser storage · no production route or save API</p></header>
    <div className="toolbar">
      <label>Engine <select value={engine} onChange={(e) => { setEngine(e.target.value); setGeneration((value) => value + 1); }}><option value="slate">Slate</option><option value="tiptap">Tiptap / ProseMirror</option></select></label>
      <button onClick={() => switchMode(mode === "source" ? "wysiwyg" : "source")}>{mode === "source" ? "WYSIWYG" : "Source JSON"}</button>
      <button onClick={() => { const errors = validate(document); if (errors.length) setMessage(errors.join("; ")); else { localStorage.setItem(storeKey, JSON.stringify(document)); setMessage("Saved locally"); } }}>Save locally</button>
      <button onClick={() => { const stored = localStorage.getItem(storeKey); if (stored) reset(JSON.parse(stored)); else setMessage("No local save"); }}>Reload local save</button>
      <button onClick={() => reset(fixture)}>Reset fixture</button>
      <button onClick={() => setShowReader((value) => !value)}>{showReader ? "Hide reader" : "Show reader"}</button>
      <button onClick={() => { const start = performance.now(); const next = longDocument(200); reset(next); setTiming({ ms: Math.round(performance.now() - start), bytes: new TextEncoder().encode(JSON.stringify(next)).length, blocks: next.nodes.length }); }}>Load long document</button>
    </div>
    {timing && <p>Long fixture generation: {timing.ms} ms · {timing.blocks} top-level nodes · {timing.bytes} UTF-8 bytes. See browser Performance panel for editor input timing.</p>}
    {message && <p role="alert" className="message">{message}</p>}
    <div className="columns"><section>
      <h2>{mode === "source" ? "Structured source" : "Editable ritual"}</h2>
      {mode === "source" ? <><p>This spike uses validated semantic JSON for source mode. Markdown/directives remain a design option.</p><textarea aria-label="Semantic source JSON" value={source} onChange={(e) => setSource(e.target.value)} /><button onClick={applySource}>Apply source and return to editor</button></> :
        engine === "slate" ? <SlateSpike key={`slate-${generation}`} document={document} onDocument={setDocument} /> : <TiptapSpike key={`tiptap-${generation}`} document={document} onDocument={setDocument} />}
    </section>{showReader && <Reader document={document} />}</div>
    <details><summary>Current document and validation</summary><p>{validate(document).length ? validate(document).join("; ") : "Valid"}</p><pre>{JSON.stringify(document, null, 2)}</pre></details>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
