import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEditor } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withHistory } from "slate-history";

function App() {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [value, setValue] = useState([{ type: "paragraph", children: [{ text: "Basic editor" }] }]);
  return <Slate editor={editor} initialValue={value} onChange={setValue}><Editable aria-label="Slate size sample" /></Slate>;
}
createRoot(document.getElementById("root")).render(<App />);
