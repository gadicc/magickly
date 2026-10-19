"use client";

import dynamic from "next/dynamic";

/**
 * The hall editor loads after the page, on the client only: it reads this
 * browser's draft and the link's fragment, and its code (the visual
 * editor, the Pug source panel, the parser) stays out of the page shell.
 */
const HallPlayground = dynamic(() => import("./HallPlayground"), {
  ssr: false,
  loading: () => <p role="status">Loading the hall editor…</p>,
});

export default function HallPlaygroundLoader() {
  return <HallPlayground />;
}
