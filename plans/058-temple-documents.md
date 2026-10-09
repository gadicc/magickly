# Temple documents — proposal and questions for the operator

Status: **proposal, nothing built.** Gadi asked for this to be written up
before any code, with the questions that only the operator can answer. It
builds on the ritual editor ([plan 038](038-ritual-editor-implementation.md)),
the grade-gated rituals of [plan 007](007-sql-ritual-write-contract.md), the
offline lease of [plan 006](006-private-offline.md) and the temple
administration work of [plan 057](057-temple-administration.md).

## Why

Temples that share material today hand out "faded photocopies of photocopies".
Rituals on Magick.ly already solve that for one kind of paper: the text is
typed once, laid out for a phone, restricted by grade, downloadable for use
without a connection, and withdrawn when someone leaves or is demoted
([temples guide](../src/app/help/temples/page.tsx)). The same machinery suits
the rest of a temple's papers: knowledge lectures, officer notes, calendars,
reading lists, grade examinations, minutes.

Temples may be physical, with in-person attendance; the readers are often in a
poorly lit hall with a phone, an unreliable signal and a paper copy they would
rather not carry. That is the design centre: **readable on a phone, available
offline, withdrawn on removal.**

## Proposal

**A document is a ritual-shaped thing with a type.** Generalise the `rituals`
table, its revisions, compiled artifacts, bundles, publication and offline
lease into *documents*, with `kind` as an enumerated column, `ritual` being
the first value. The ritual list becomes one view over documents of kind
`ritual`; a temple's library is another view with kind filters and grouping.

- **Same scope model.** Public, group, or temple with a minimum grade, exactly
  as [access.ts](../src/doc/access.ts) defines them. Reading follows the current
  grade; editing follows temple administration; offline copies lock within 14
  days. No new permission concepts for the first version.
- **Same editor, per-kind shape.** The semantic editor already edits
  structured content (title, sections, notes, tasks, images, variables). A
  ritual uses all of it; a lecture or officer note would use a subset (no
  speeches/actions), so each kind gets a *profile* that selects the block types
  it offers and how the reader lays it out. Start by reusing the ritual editor
  unchanged for every kind and trim later.
- **Categories.** A document has a `kind` (what it is) and a temple-defined
  *collection* (where it lives: "Zelator papers", "Officers", "Calendar").
  Collections are plain labels with an order, per temple; a document may sit in
  one.
- **Listing.** Library page per temple, grouped by collection then kind, showing
  only what the signed-in member may read. `/gd/rituals` remains, filtered to
  `kind = ritual`.
- **Attachments.** PDF and images for papers that cannot be retyped. These
  reuse the file storage and the offline asset bundle; a scan is a poor reading
  experience, so the page should say so and offer retyping as the better path.

## What the original Order did, as a starting point for kinds

Findings from public sources, to be confirmed by the operator; a name appears
here only where a source states it.

| Family | What it was | Source |
| --- | --- | --- |
| Cipher Manuscripts | The founding documents, in English in the Trithemius cipher: the grade rituals and a curriculum covering Qabalah, astrology, tarot, geomancy and alchemy. Decoded by Westcott in 1887. | [Wikipedia: Cipher Manuscripts](https://en.wikipedia.org/wiki/Cipher_Manuscripts); [Hermetic Order of the Golden Dawn](https://en.wikipedia.org/wiki/Hermetic_Order_of_the_Golden_Dawn) |
| Grade rituals | One initiation per grade (0=0 Neophyte to the Adeptus grades), with the Portal as an intermediate grade. | [OSOGD curriculum](https://osogd.org/?p=19) |
| Knowledge Lectures (and Side Lectures) | A paper for each grade from 0=0 to 4=7, learned for the examination, plus Portal addresses. | [Complete Knowledge Lectures (Fuller)](https://www.booksamillion.com/p/Complete-Knowledge-Lectures-Side-Golden/Tony-Fuller/9781908705280) |
| Examinations | A written test and practical work per grade for advancement. | [OSOGD curriculum](https://osogd.org/?p=19) (a modern order's use) |
| Flying Rolls | Numbered instructional papers from the Second Order's chiefs, for those at the Portal grade or above, circulated singly from member to member. | [OSOGD](https://osogd.org/?p=202) |
| Z Documents | Teaching papers that expand the Isis-Urania ritual with its symbolism and a mythological frame. | [OSOGD](https://osogd.org/?p=66) |
| Book T | The Tarot book. | [Book T listings](https://www.goodreads.com/book/show/472839) |
| Second Order instruction | Magical practice: scrying, astral travel, alchemy; initiation rituals for the adept grades. | [Hermetic Order of the Golden Dawn](https://en.wikipedia.org/wiki/Hermetic_Order_of_the_Golden_Dawn) |

Candidate kinds for Magick.ly, mapped from the above and from what a modern
temple keeps: `ritual`, `knowledge-lecture`, `examination`, `instruction`
(Flying Rolls, Z papers: numbered teaching papers), `reference` (tables, books),
`notice` (summons, calendar), `minutes`. This list is a guess to be corrected
by the operator, who knows what temples actually hold.

I found no usable source for the "Book" letters beyond Book T (M, H and others
are named in Regardie's volumes, which I could not reach) or for the exact
classification the Order used internally. Those are the first thing to settle
from a primary source.

## Questions and checks for the operator

1. **Primary sources.** Israel Regardie's *The Golden Dawn* (1937–1940, four
   volumes) is the standard compilation and organises the Order's papers by
   family; its table of contents would settle the kinds above. Check whether
   its text is public domain: Regardie died in 1985, but the Order's own papers
   (by Mathers, Westcott, Woodman and others, who died before 1930) are
   older than his edition, and the question is what a 1937 edition adds that
   is protected. The [Stanford Copyright Renewal Database](https://exhibits.stanford.edu/copyrightrenewals)
   answers it for US renewals; a lawyer for the rest. Until then, nothing is to
   be copied from Regardie's edition, only classified by it.
2. **Which kinds do your temples actually keep?** List the papers a temple
   hands out in a year, grade by grade, and say which are read once, which are
   kept, and which are circulated.
3. **Who may create documents?** Rituals: temple administrators. Should a
   grade-gated *library* have per-collection editors (an officer who keeps the
   knowledge lectures but is not a temple administrator)?
4. **Attachments.** Do temples hold scanned papers they cannot retype? How many,
   and how large (a 40-page scan is a different problem from a one-page
   notice)?
5. **Visibility granularity.** Is a minimum grade enough, or do some papers need
   "exactly grade 3" or "officers only"? (Listed with the other ideas in the [follow-ups of plan 057](057-temple-administration.md#follow-ups).)
6. **Printing.** Should a member be able to print or export a document, and
   with a watermark? (Same list.)
7. **Migration.** Existing rituals become documents of kind `ritual` in place;
   no member-visible change. Confirm that is wanted.

## Staging

1. Plan and decisions (this document).
2. Schema: `documents` with `kind` and `collection`; rituals keep their IDs;
   views and APIs keep working through the same policy code.
3. Library page and collection management for temple administrators.
4. Kind profiles in the editor and reader; non-ritual kinds first as plain
   sections and notes.
5. Attachments.

Each stage is its own gated change. Offline bundles, leases and revocation
carry over unchanged because they key on the document ID and its scope.

## Risks

- **Scope creep into a CMS.** The point is private, mobile, withdrawable
  papers for small groups, not a wiki. Resist page trees, comments and search
  beyond a title filter.
- **Generalising too early.** The ritual code paths carry offline, lease and
  receipt rules that were hard won. Rename and widen them behind the existing
  tests rather than writing a parallel stack.
- **Copyright of what temples upload.** Temples may hold material they do not
  own. Magick.ly is a reader for the temple's own papers; terms of use and a
  takedown route are needed before attachments open up.
