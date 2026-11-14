"use client";

import * as React from "react";

/**
 * The Enochian box's keypad (plan 074, decisions 2 and 4), shared by the
 * dictionary and the translator: whether it is open, and `edit`, which
 * puts a letter at the box's caret, or deletes before it, and puts the
 * caret back once the change has rendered.
 */
export function useKeypadBox<
  Box extends HTMLInputElement | HTMLTextAreaElement,
>(text: string, setText: (text: string) => void) {
  const box = React.useRef<Box>(null);
  const [keypad, setKeypad] = React.useState(false);
  // Where the caret goes once the keypad's change has rendered.
  const caret = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    if (caret.current === null) return;
    box.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  /** Puts `letter` at the Enochian box's caret, or deletes before it. */
  const edit = (letter: string | null) => {
    const element = box.current;
    if (!element) return;
    const start = element.selectionStart ?? text.length;
    const end = element.selectionEnd ?? text.length;
    const from =
      letter === null && start === end ? Math.max(0, start - 1) : start;
    caret.current = from + (letter?.length ?? 0);
    setText(text.slice(0, from) + (letter ?? "") + text.slice(end));
  };

  return { box, keypad, setKeypad, edit };
}
