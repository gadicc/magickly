import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { CSSProperties, ReactNode } from "react";
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
}: {
  role: string;
  roles: Record<string, RitualRolePresentation>;
  /** Authoring shows a neutral card, without a selected reader's audience shift. */
  audience?: "self" | "other" | "author";
  samePreviousRole?: boolean;
  page?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
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
            {Array.from(new Set(role.split(","))).map((entry) => (
              <span key={entry}>{roles[entry]?.symbol}</span>
            ))}
          </div>{" "}
          <div className={styles.roleName}>
            {Array.from(new Set(role.split(","))).map((entry) => (
              <span
                key={entry}
                style={{ color: roles[entry]?.color, marginRight: 3 }}
              >
                {roles[entry]?.name ||
                  entry.slice(0, 1).toUpperCase() + entry.slice(1)}
              </span>
            ))}
          </div>
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
