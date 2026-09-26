import React, { useState } from "react";
import { audienceIncludes } from "./model.js";

export default function Reader({ document }) {
  const [role, setRole] = useState("hierophant");
  const declarations = document.nodes.filter((node) => node.type === "declaration");
  const [values, setValues] = useState({});
  const current = Object.fromEntries(declarations.map((node) => [node.name, values[node.name] ?? node.default]));
  const inline = (node, index) => {
    if (node.type === "text") return <span key={index} dir={node.dir} lang={node.lang} style={{ fontWeight: node.marks?.includes("bold") ? "bold" : undefined, fontStyle: node.marks?.includes("italic") ? "italic" : undefined }}>{node.text}</span>;
    if (node.type === "variableRef") return <span key={index} className="substitution">{current[node.name] ?? `Unknown variable: ${node.name}`}</span>;
    if (node.type === "grade") return <strong key={index} className="grade">{node.value}</strong>;
    return null;
  };
  const block = (node) => {
    const content = node.children?.map((child, index) => ["text", "variableRef", "grade"].includes(child.type) ? inline(child, index) : block(child));
    if (node.type === "heading") return React.createElement(`h${node.level}`, { key: node.id, id: node.anchor }, content);
    if (node.type === "paragraph") return <p key={node.id}>{content}</p>;
    if (node.type === "task") return audienceIncludes(node.audience, role, document.aliases) ? <section key={node.id} className="reader-task"><b>{node.mode === "say" ? "Speech" : "Action"} · {node.audience.scope}</b>{content}</section> : null;
    if (node.type === "note") return <aside key={node.id} className="reader-note">{content}</aside>;
    if (node.type === "summary") return <details key={node.id}><summary>{node.label}</summary>{content}</details>;
    if (node.type === "footnote") return <aside key={node.id} className="reader-footnote"><b>Footnote</b>{content}</aside>;
    if (node.type === "image") return <img key={node.id} src={node.src} alt={node.alt} width={node.width} />;
    if (node.type === "legacy") return <aside key={node.id} className="legacy">Unsupported legacy source: <code>{node.source}</code></aside>;
    return null;
  };
  return <section className="reader">
    <h2>Read-only ritual preview</h2>
    <label>Reader role <select value={role} onChange={(event) => setRole(event.target.value)}>
      {["hierophant", "hiero", "keryx", "candidate", "member"].map((entry) => <option key={entry}>{entry}</option>)}
    </select></label>
    {declarations.filter((node) => node.name !== "myRole").map((node) => <label key={node.id}>{node.label} <input value={current[node.name]} onChange={(event) => setValues((previous) => ({ ...previous, [node.name]: event.target.value }))} /></label>)}
    <article>{document.nodes.map(block)}</article>
  </section>;
}
