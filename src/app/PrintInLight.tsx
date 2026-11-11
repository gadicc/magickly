"use client";
import { useEffect } from "react";

/**
 * Print stays light (plan 076, decision 5). The scheme is a class on
 * `<html>` (`COLOR_SCHEME_ATTRIBUTE` in `@/colorScheme`), and while it says
 * `dark` every dark rule (MUI's variables, `applyStyles`, `.dark` page CSS)
 * would reach paper. This swaps it to `light` for the print and puts the
 * reader's scheme back afterwards. It reads the class only in the event, so
 * nothing renders differently by mode.
 */
export default function PrintInLight() {
  useEffect(() => {
    const root = document.documentElement;
    let swapped = false;
    const beforePrint = () => {
      swapped = root.classList.replace("dark", "light");
    };
    const afterPrint = () => {
      if (swapped) root.classList.replace("light", "dark");
      swapped = false;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return null;
}
