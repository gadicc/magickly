/**
 * Reads what a page's export controls offer, as a reader would: by the
 * Link buttons (plan 097). An image link is copied, never shown, so the
 * only way to learn it is to press Link; these do, with a stand-in
 * clipboard.
 */
import { act, fireEvent, screen } from "@testing-library/react";

const linkButtons = (format: string) =>
  screen.queryAllByRole("button", { name: `Copy ${format} image link` });

/** Whether the export controls' first (or `index`th) Link copies a link. */
export function imageLinkOffered(index = 0, format = "SVG"): boolean {
  const button = linkButtons(format)[index];
  return Boolean(button) && button.getAttribute("aria-disabled") !== "true";
}

/** Presses a Link button and lets its confirmation settle. */
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Presses Link and returns the image link it copied, site-relative. Fails
 * when there is no Link, when it only explains, or when it copies nothing.
 */
export async function copiedImageLink(
  index = 0,
  format = "SVG",
): Promise<string> {
  const button = linkButtons(format)[index];
  if (!button) throw new Error(`No "Copy ${format} image link" button`);
  if (button.getAttribute("aria-disabled") === "true")
    throw new Error(`"Copy ${format} image link" offers no link`);
  if (button.hasAttribute("disabled"))
    throw new Error(`"Copy ${format} image link" is busy`);
  const copied: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied.push(text);
      },
    },
  });
  try {
    await press(button);
  } finally {
    if (previous) Object.defineProperty(navigator, "clipboard", previous);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  }
  if (copied.length !== 1)
    throw new Error(`Link copied ${copied.length} texts`);
  const url = new URL(copied[0]);
  if (url.origin !== window.location.origin)
    throw new Error(`Link copied another site's link: ${copied[0]}`);
  return url.pathname + url.search;
}

/**
 * Presses a Link that offers no link and returns what it says instead.
 * Fails when the Link would copy one.
 */
export async function imageLinkNote(
  index = 0,
  format = "SVG",
): Promise<string> {
  const button = linkButtons(format)[index];
  if (!button) throw new Error(`No "Copy ${format} image link" button`);
  if (button.getAttribute("aria-disabled") !== "true")
    throw new Error(`"Copy ${format} image link" offers a link`);
  await press(button);
  const alerts = screen.getAllByRole("alert");
  return alerts[alerts.length - 1].textContent ?? "";
}
