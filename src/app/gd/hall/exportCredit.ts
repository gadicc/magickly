/**
 * What the hall editor's exports say about the art they draw (plan 062,
 * decision 12; Gadi, 26 October 2026): the art is Magick.ly's under CC BY
 * 4.0 and is credited, but the hall as arranged is the author's, so the
 * files state no licence or rights for the drawing itself.
 */

import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { SITE_URL } from "@/seo/site";

const L = GD_HALL_LICENCE;

/** The credit, in words. */
export const HALL_ART_CREDIT = `Hall art: ${L.creator}, ${L.name} (${L.url}), drawn with the temple hall editor at ${SITE_URL}/gd/hall. The licence covers the art, not the hall as arranged.`;

/** `ExportControls`' credit for a hall: SVG metadata and an XMP packet. */
export const hallArtCredit = {
  svg:
    "<metadata>" +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<rdf:Description rdf:about=""><dc:description>${HALL_ART_CREDIT}</dc:description></rdf:Description>` +
    "</rdf:RDF></metadata>",
  xmp:
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about=""' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">' +
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${HALL_ART_CREDIT}</rdf:li></rdf:Alt></dc:description>` +
    `<photoshop:Credit>Hall art: ${L.creditText}</photoshop:Credit>` +
    "</rdf:Description></rdf:RDF></x:xmpmeta>" +
    '<?xpacket end="r"?>',
} as const;
