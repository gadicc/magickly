"use client";

import { Alert, Button } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";

/**
 * The hall editor loads after the page, on the client only: it reads this
 * browser's draft and the link's fragment, and its code (the visual
 * editor, the Pug source panel, the parser) stays out of the page shell.
 */
const HallPlayground = dynamic(() => import("./HallPlayground"), {
  ssr: false,
  loading: () => <p role="status">Loading the hall editor…</p>,
});

/**
 * Says so when the editor's code could not load (offline before it was
 * cached, or a tab left open across a deploy) or the editor failed,
 * instead of Next's client error screen; reloading usually mends both.
 */
export class HallEditorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        }
      >
        The hall editor could not load, or stopped working.
      </Alert>
    );
  }
}

export default function HallPlaygroundLoader() {
  return (
    <HallEditorBoundary>
      <HallPlayground />
    </HallEditorBoundary>
  );
}
