import { createContext } from "react";

/**
 * The attribute the hall editor puts on the roots of its own popups (the
 * palette's menus and the properties panel's selects), with the hall's
 * ID. MUI portals them to the document's body, outside the editor: a
 * host that reads the focus by where it lands (the ritual editor's link,
 * plan 064) finds the hall through it.
 */
export const HALL_POPUP_ATTRIBUTE = "data-gd-hall-popup";

/** The props of a popup's root (`HALL_POPUP_ATTRIBUTE` for its hall). */
export type HallPopupRoot = Readonly<Record<string, string>>;

/** A popup root's props, as the hall editor gives them to its panel. */
export const HallPopupRootContext = createContext<HallPopupRoot>({});

/** A popup root's props for the hall with this ID. */
export const hallPopupRoot = (hallId: string): HallPopupRoot => ({
  [HALL_POPUP_ATTRIBUTE]: hallId,
});
