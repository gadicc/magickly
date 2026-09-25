import React from "react";
import { createRoot } from "react-dom/client";
import Reader from "./Reader.jsx";
import { fixture } from "./model.js";
import "./style.css";

createRoot(document.getElementById("root")).render(<Reader document={fixture} />);
