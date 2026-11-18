import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { CSSProperties, ReactNode } from "react";
import { inkClass } from "@/drawings/Ink";
import { plateClass } from "@/drawings/plate";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import {
  canonicalRole,
  parseRoleAssignment,
  roleAssignmentLabel,
} from "../ritualRoles";
import styles from "./frames.module.css";
import type { RitualRolePresentation } from "./roles";

/**
 * A single officer's colours as the variables the frame reads, for its
 * role name and a direction's rule: its own in light, its lighter
 * `darkColor` in dark (plan 076, step 5). Groups and roles without a colour
 * set them to `initial`, so that a task drawn inside another (a footnote's)
 * does not inherit the outer officer's: the name then inherits the text
 * colour and the rule is neutral (plan 089, decision 1).
 */
function roleColorStyle(role: RitualRolePresentation | undefined) {
  return {
    "--ritual-role": role?.color ?? "initial",
    "--ritual-role-dark": role?.color
      ? (role.darkColor ?? role.color)
      : "initial",
  } as CSSProperties;
}

/**
 * Formatting slots shared by JRT reading and editor-owned child DOM. Speech
 * is a bubble, a direction a rubric on the surface (plan 089, decision 1);
 * both kinds share one root element, styled by `data-kind`, so switching a
 * task's kind in the editor never remounts its content slot.
 */
export function TaskFrame({
  role,
  roles,
  kind,
  audience = "other",
  continues,
  page,
  children,
  footer,
  headerActions,
}: {
  role: string;
  roles: Record<string, RitualRolePresentation>;
  /** Speech or a direction ("do"). */
  kind: "say" | "do";
  /** Authoring shows a neutral card, without a selected reader's audience shift. */
  audience?: "self" | "other" | "author";
  /**
   * The kind of the previous task when it has the same role: this one then
   * drops its role line and closes up to it, and a direction after speech
   * tucks under the bubble (plan 089, decision 3).
   */
  continues?: "say" | "do";
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
  const presentation = (entry: string) =>
    Object.hasOwn(roles, entry) ? roles[entry] : undefined;
  return (
    <div
      className={styles.task}
      data-ritual-frame="task"
      data-kind={kind}
      data-audience={audience}
      data-continues={continues}
      style={roleColorStyle(
        individualRoles.length === 1
          ? presentation(individualRoles[0])
          : undefined,
      )}
    >
      {/* First, floated: rows without a role line wrap around it. */}
      {page !== undefined && (
        <span className={styles.page} contentEditable={false}>
          {page}
        </span>
      )}
      {!continues && (
        <div className={styles.role} contentEditable={false}>
          {/* The symbols only repeat the role names beside them. */}
          <div
            className={`${styles.roleSymbol} ${inkClass("lamen")}`}
            aria-hidden="true"
          >
            {individualRoles.map((entry) => (
              <span key={entry}>{presentation(entry)?.symbol}</span>
            ))}
          </div>{" "}
          <div className={styles.roleName}>
            {individualRoles.length
              ? individualRoles.map((entry, index) => (
                  <span
                    key={entry}
                    className={styles.roleColor}
                    // One officer's colours are the frame's; each of
                    // several names carries its own.
                    style={
                      individualRoles.length > 1
                        ? roleColorStyle(presentation(entry))
                        : undefined
                    }
                  >
                    {index > 0 &&
                      (index === individualRoles.length - 1 ? " and " : ", ")}
                    {presentation(entry)?.name ||
                      entry.slice(0, 1).toUpperCase() + entry.slice(1)}
                  </span>
                ))
              : roleAssignmentLabel(role, roles)}
          </div>
          {headerActions}
        </div>
      )}
      {children}
      {footer}
    </div>
  );
}

/**
 * Keep the body slot stable when switching speech/action or selecting a
 * task. A direction carries its translated kind for screen readers, which
 * announce the visually hidden generated content; it is never copied and
 * never part of the editor's content.
 */
export function TaskBody({
  action,
  children,
}: {
  action: boolean;
  children: ReactNode;
}) {
  const { t } = useUiLanguage();
  return (
    <div
      className={action ? `do ${styles.action}` : `say ${styles.speech}`}
      data-kind-label={action ? t(/*i18n*/ "Direction") : undefined}
    >
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
    <Paper
      data-ritual-frame="title"
      sx={{
        p: 1,
        mb: 1,
        bgcolor: "ritual.bubble",
        backgroundImage: "none",
      }}
    >
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
      sx={{
        p: 1,
        mb: 1,
        mx: 2.5,
        bgcolor: "ritual.note",
        backgroundImage: "none",
      }}
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

/**
 * Receives an already-authorized reader URL or an editor-approved file
 * locator. In dark every image stands on a light plate (plan 076,
 * decision 4): members' uploads may be drawn dark on transparent.
 */
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
      className={`${plateClass}${editing ? ` ${styles.editImage}` : ""}`}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
    />
  );
}
