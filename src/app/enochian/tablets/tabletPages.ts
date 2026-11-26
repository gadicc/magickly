import {
  TABLET_IDS,
  type TabletImageId,
} from "@/render/contracts/enochianTablet";

/**
 * The tablets' own pages (plan 100): one for each of the four Watchtowers
 * and one for the Tablet of Union, under the tool's hub, in the order the
 * tool and the image contracts list them. Server-safe: the tool's own
 * `urlState.ts` is a client module.
 */

/** The tool, and the tablets' pages' hub. */
export const TABLETS_HUB_PATH = "/enochian/tablets";

/** The five tablets with a page: Earth, Air, Water, Fire, then the Union. */
export const TABLET_PAGE_IDS = TABLET_IDS;

/** A tablet with a page of its own. */
export type TabletPageId = TabletImageId;

/** A tablet's page: `/enochian/tablets/fire`. */
export const tabletPath = (id: TabletPageId) => `${TABLETS_HUB_PATH}/${id}`;
