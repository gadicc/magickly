# Offline section candidates

A collection-independent diagnostic comparing source-filtered lexical hits with
bounded ordinal/section candidates. Supply an owned catalog, registered text units
and independently pinned complete primary pages over local stdin to `cli.mts`.
No provider, vector database or OCR process is called. Output includes page/count/
status metadata, never question, heading, title or passage/parent text.

The canonical page view uses NFC paragraph normalization and UTF-16 coordinates,
not raw PDF offsets. Only unique exact unit matches establish order; ambiguous,
missing, overlapping or multi-page matches remain qualified. Native text is an
extraction path, not proof of transcription accuracy or complete visual content.

Recognized ASCII Step/Roman/Arabic tokens can establish candidate headings and
uncertain barriers. Duplicate sequences, contents, ranges, negation and multi-source
intent remain conservative. Unicode/OCR forms outside the token grammar may be
missed inside an interval. Complete canonical text coverage between recognized
anchors is not proof of complete structure or correct instructions. Evaluate or
refuse unsupported STEP-like forms before any production adoption.

The registered-unit lane never clips units. A separate helper can derive new
bounded canonical span text, including boundaries inside existing units. That
private parent is explicitly UNREGISTERED and incompatible with the active corpus;
new registration, provenance and processing authority are needed before use.
Unit/byte/character bounds here are not a complete provider request/token bound.

Run the synthetic tests through the project's normal Vitest task. A real collection
adapter, input pins, private review data and experiment results belong in a private
companion repository, not this public CLI or its examples.
