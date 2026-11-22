import { hallCardArt, type SocialCard, socialCard } from "./cards";
import { componentPages } from "./components";
import { entityPages } from "./entities";
import { hallPages } from "./halls";
import { lenainPages } from "./lenain";
import { PUBLIC_PAGES, type SeoPage } from "./pages";
import { planetaryNameCardArtAt } from "./planetaryNames";

/**
 * Every card the build draws: public pages without an image of their own,
 * then entity pages. Kept apart from the card helpers so page metadata does
 * not load the data set.
 */
export function socialCards(): SocialCard[] {
  return [
    ...(Object.entries(PUBLIC_PAGES) as [string, SeoPage][])
      .filter(([, page]) => !page.image)
      .map(([path, page]) => socialCard(path, page.title)),
    // A planetary name's card draws its sigil (plan 093, K4); the other
    // entities', their section's art.
    ...entityPages().map((page) =>
      socialCard(page.path, page.title, planetaryNameCardArtAt(page.path)),
    ),
    ...lenainPages().map((page) => socialCard(page.path, page.title)),
    ...componentPages().map((page) => socialCard(page.path, page.title)),
    // Each temple hall's card draws that hall (plan 062).
    ...hallPages().map((page) =>
      socialCard(
        page.path,
        page.title,
        hallCardArt(page.path.split("/").at(-1) as string),
      ),
    ),
  ];
}
