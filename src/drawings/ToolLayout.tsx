import type { ReactNode } from "react";
import styles from "./toolLayout.module.css";

/**
 * A drawing tool's page (plan 094's A3): its `ToolControls` (the fields, the
 * version menu, the switches), its `ToolDrawing`, then its `ToolPanel`
 * (exports, the version's note, anything else), in that order. One column
 * on a narrow screen; from 1,200 px the drawing beside a 22rem column of the
 * controls and the panel (toolLayout.module.css). CSS alone places them, so
 * it renders on the server as it is.
 *
 * The parts are children, never props: site search reads a page's JSX
 * children and no props (scripts/search/prose.ts), so text passed in a prop
 * would drop out of the index.
 */
export default function ToolLayout({ children }: { children: ReactNode }) {
  return <div className={styles.layout}>{children}</div>;
}

/** What changes the drawing: beside it from 1,200 px, above it below that. */
export function ToolControls({ children }: { children: ReactNode }) {
  return <div className={styles.controls}>{children}</div>;
}

/** The drawing, sized to the window and sticky from 1,200 px. */
export function ToolDrawing({ children }: { children: ReactNode }) {
  return <div className={styles.drawing}>{children}</div>;
}

/** Exports, the version's note and the rest, under the controls. */
export function ToolPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
