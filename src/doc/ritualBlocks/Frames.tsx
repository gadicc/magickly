import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { CSSProperties, ReactNode } from "react";
import {
  canonicalRole,
  parseRoleAssignment,
  roleAssignmentLabel,
} from "../ritualRoles";
import styles from "./frames.module.css";
import type { RitualRolePresentation } from "./roles";

/** Formatting slots shared by JRT reading and editor-owned child DOM. */
export function TaskFrame({
  role,
  roles,
  audience = "other",
  samePreviousRole = false,
  page,
  children,
  footer,
  headerActions,
}: {
  role: string;
  roles: Record<string, RitualRolePresentation>;
  /** Authoring shows a neutral card, without a selected reader's audience shift. */
  audience?: "self" | "other" | "author";
  samePreviousRole?: boolean;
  page?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Editor controls are a slot; the reader graph remains independent of editor code. */
  headerActions?: ReactNode;
}) {
  const assignment = parseRoleAssignment(role);
  const individualRoles =
    assignment?.basis === "roles"
      ? [...new Set(assignment.roles.map(canonicalRole))]
      : [];
  return (
    <Paper
      className={styles.task}
      data-ritual-frame="task"
      data-audience={audience}
      sx={{
        px: 2,
        pt: 1,
        pb: 1,
        mb: 1.6,
        mt: samePreviousRole ? -1 : 0,
        ml: audience === "self" ? 5 : 0,
        mr: audience === "other" ? 5 : 0,
        background: audience === "self" ? "#d9fdd3" : undefined,
        position: "relative",
      }}
    >
      {!samePreviousRole && (
        <div className={styles.role} contentEditable={false}>
          <div className={styles.roleSymbol}>
            {individualRoles.map((entry) => (
              <span key={entry}>
                {Object.hasOwn(roles, entry) ? roles[entry].symbol : undefined}
              </span>
            ))}
          </div>{" "}
          <div className={styles.roleName}>
            {individualRoles.length
              ? individualRoles.map((entry, index) => (
                  <span
                    key={entry}
                    style={{
                      color: Object.hasOwn(roles, entry)
                        ? roles[entry].color
                        : undefined,
                    }}
                  >
                    {index > 0 &&
                      (index === individualRoles.length - 1 ? " and " : ", ")}
                    {(Object.hasOwn(roles, entry) && roles[entry].name) ||
                      entry.slice(0, 1).toUpperCase() + entry.slice(1)}
                  </span>
                ))
              : roleAssignmentLabel(role, roles)}
          </div>
          {headerActions}
        </div>
      )}
      {page !== undefined && (
        <span className={styles.page} contentEditable={false}>
          {page}
        </span>
      )}
      {children}
      {footer}
    </Paper>
  );
}

/** Keep the body slot stable when switching speech/action or selecting a task. */
export function TaskBody({
  action,
  children,
}: {
  action: boolean;
  children: ReactNode;
}) {
  return (
    <div className={action ? `do ${styles.action}` : `say ${styles.speech}`}>
      {children}
    </div>
  );
}

export function TitleFrame({
  anchor,
  editing = false,
  children,
}: {
  anchor?: string;
  editing?: boolean;
  children: ReactNode;
}) {
  return (
    <Paper data-ritual-frame="title" sx={{ p: 1, mb: 1, background: "#fff" }}>
      {anchor && <a id={anchor} />}
      <Typography
        variant="h5"
        component={editing ? "div" : "h5"}
        role={editing ? "heading" : undefined}
        aria-level={editing ? 5 : undefined}
        className={styles.title}
      >
        {children}
      </Typography>
    </Paper>
  );
}

export function NoteFrame({ children }: { children: ReactNode }) {
  return (
    <Paper
      data-ritual-frame="note"
      className={`note ${styles.note}`}
      sx={{ p: 1, mb: 1, mx: 2.5, background: "#f4f4f4" }}
    >
      {children}
    </Paper>
  );
}

/** Authoring always exposes the children; reading retains native collapse behavior. */
export function SummaryFrame({
  title,
  editing = false,
  children,
}: {
  title: string;
  editing?: boolean;
  children: ReactNode;
}) {
  return editing ? (
    <div className={styles.summary} data-ritual-frame="summary">
      <div className={styles.summaryHeading} contentEditable={false}>
        ▾ {title || "Summary"}
      </div>
      {children}
    </div>
  ) : (
    <details className={styles.summary} data-ritual-frame="summary">
      <summary className={styles.summaryHeading}>{title}</summary>
      {children}
    </details>
  );
}

export function GradeFrame({ grade }: { grade: string }) {
  const [left, right] = grade.split("=");
  return (
    <span className={`grade ${styles.grade}`} data-ritual-frame="grade">
      <span className={styles.circled}>{left}</span>
      <span className={styles.equals}>=</span>
      <span className={styles.squared}>{right}</span>
    </span>
  );
}

/** Native reader lists and editor-owned slots share spacing and marker styles. */
export function ListFrame({
  ordered,
  editing = false,
  children,
}: {
  ordered: boolean;
  editing?: boolean;
  children: ReactNode;
}) {
  const Element = editing ? "div" : ordered ? "ol" : "ul";
  return (
    <Element
      data-ritual-frame={ordered ? "ol" : "ul"}
      data-editing={editing || undefined}
      role={editing ? "list" : undefined}
      className={`${styles.list} ${ordered ? styles.ordered : styles.unordered}`}
    >
      {children}
    </Element>
  );
}

export function ListItemFrame({
  editing = false,
  children,
}: {
  editing?: boolean;
  children: ReactNode;
}) {
  const Element = editing ? "div" : "li";
  return (
    <Element
      data-ritual-frame="li"
      data-editing={editing || undefined}
      role={editing ? "listitem" : undefined}
      className={styles.listItem}
    >
      {children}
    </Element>
  );
}

export function TodoFrame({ children }: { children: ReactNode }) {
  return (
    <div data-ritual-frame="todo" className={styles.todo}>
      (TODO: {children})
    </div>
  );
}

export function FootnoteReferenceFrame({
  number,
  children,
}: {
  number: number;
  children?: ReactNode;
}) {
  return (
    <sup
      data-ritual-frame="footnote-reference"
      className={styles.footnoteReference}
    >
      {children ?? number}
    </sup>
  );
}

/** Editing exposes the collected bodies; reading keeps native disclosure. */
export function FootnotesFrame({
  editing = false,
  children,
}: {
  editing?: boolean;
  children: ReactNode;
}) {
  return editing ? (
    <div data-ritual-frame="footnotes" className={styles.footnotes}>
      <div className={styles.footnotesHeading} contentEditable={false}>
        Footnotes
      </div>
      <ol>{children}</ol>
    </div>
  ) : (
    <details data-ritual-frame="footnotes" className={styles.footnotes}>
      <summary>Footnotes</summary>
      <ol>{children}</ol>
    </details>
  );
}

/** Receives an already-authorized reader URL or an editor-approved file locator. */
export function ImageFrame({
  src,
  alt,
  width,
  height,
  style,
  editing = false,
}: {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  editing?: boolean;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: reader URLs and scoped editor file locators
    <img
      data-ritual-frame="img"
      className={editing ? styles.editImage : undefined}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
    />
  );
}
