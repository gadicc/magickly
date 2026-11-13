import type { Metadata } from "next";
import { EXPLORER_COMPONENTS, explorerComponent } from "@/explorer/components";
import type { EntityPage } from "./entities";
import { seoMetadata } from "./metadata";

/**
 * `/open-source/components/<slug>`, the explorer of one component (plan
 * 080, decision 1): indexed, in the sitemap and site search like an
 * entity page. The heading is the component's name; the search title says
 * what it draws.
 */
export function componentPage(slug: string): EntityPage | null {
  const component = explorerComponent(slug);
  if (!component) return null;
  return {
    path: component.path,
    title: `${component.title} React Component`,
    description: component.description,
  };
}

/** Every component's page, in the index's order. */
export function componentPages(): EntityPage[] {
  return EXPLORER_COMPONENTS.map(
    (component) => componentPage(component.slug) as EntityPage,
  );
}

/** A component page's metadata; null for a slug that names none. */
export function componentMetadata(slug: string): Metadata | null {
  const page = componentPage(slug);
  return page && seoMetadata(page.path, page);
}
