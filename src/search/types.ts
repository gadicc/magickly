/** A public, canonical page and the independently searchable passages it owns. */
export interface SearchDocument {
  path: string;
  title: string;
  description: string;
  aliases: string[];
  sections: SearchSection[];
}

/** An authoritative source excerpt; href may point to an existing page anchor. */
export interface SearchSection {
  id: string;
  title: string;
  text: string;
  href?: string;
}

/** Only public content is distributed; private rituals never enter this index. */
export interface SearchCatalogue {
  version: 1;
  documents: SearchDocument[];
}

/** One grouped page result, with its best matching passage. */
export interface SearchResult {
  path: string;
  href: string;
  title: string;
  section?: string;
  excerpt: string;
  score: number;
  match: "page" | "content" | "semantic";
  exactTitle?: boolean;
}
