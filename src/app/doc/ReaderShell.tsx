"use client";

import type { ReactNode } from "react";
import styles from "./readerShell.module.css";

/**
 * The ritual reader's page (plan 089, decision 2): the ritual surface across
 * the page and a reading column holding `title`, the page's `h1`, above the
 * ritual. Each reader route draws its heading here, and its `DocView`
 * (`chrome` on) places the variables and the ritual body in the shell's
 * areas; anything else in `children`, such as a loading or not-found
 * message, sits where the ritual would. Server-rendered as is: the layout is
 * CSS alone.
 */
export default function ReaderShell({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell} data-reader-shell="">
      {title ? (
        <div className={styles.title} data-reader-area="title">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
