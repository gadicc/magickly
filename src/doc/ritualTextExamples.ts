/** New rituals begin with editable examples, never a saved revision. */
export const ritualTextStarter = `ritual 1
@title "Opening"
@summary "Preparation":
  @note:
    = "Replace this note with preparations for your ritual."
Hiero: Welcome.
* Keryx Open the door.
@summary "Closing":
  Hiero: The ritual is concluded.
`;

/** Default semantic source starter; omitted identities are assigned by the editor. */
export const ritualPugStarter = `//- magickli-ritual-pug 1
title(text="Opening") Opening
summary(summary="Preparation")
  note Replace this note with preparations for your ritual.
Hiero: Welcome.
* Keryx Open the door.
summary(summary="Closing")
  Hiero: The ritual is concluded.
`;

/** Public guide examples parsed in tests, including the exact literal/opaque fallbacks. */
export const ritualPugExamples = {
  inline: `//- magickli-ritual-pug 1
Hiero: Welcome, #[var(name="candidate")/]. Speak #[b clearly].
* Keryx Open the door.
`,
  structure: `//- magickli-ritual-pug 1
//- Notes for authors; omitted from the reader.

title(text="Preparation") Preparation
summary(summary="Before starting")
  note Prepare the space.
  ul
    li First item
    li Second item
todo Check this wording.
hr/
`,
  variables: `//- magickli-ritual-pug 1
declareVar(name="candidate", label="Candidate name", varType="text", default="Guest")/
declareVar(name="direction", label="Direction", varType="select", default="east")
  option(value="east", label="East")/
  option(value="west", label="West")/
Hiero: Welcome, #[var(name="candidate")/].
grade(grade="0=0")/
`,
  image: `//- magickli-ritual-pug 1
img(src="/image.svg", alt="Describe the image", width=320)/
`,
  exact: `//- magickli-ritual-pug 1
ritualText(value="Text with exact trailing space ")/
ritualLegacy(raw={"type":"synthetic-widget","mode":"preserve"})/
`,
};

/** Equivalent starting content for authors who choose the legacy Pug format. */
export const pugRitualStarter = `title(text="Opening") Opening
summary(summary="Preparation")
  note Replace this note with preparations for your ritual.
task(say role="hiero") Welcome.
task(do role="keryx") Open the door.
summary(summary="Closing")
  task(say role="hiero") The ritual is concluded.
`;

/** Executable examples shared with the guide so its syntax stays current. */
export const ritualTextExamples = {
  text: `ritual 1
= "A paragraph of ordinary text."
@br
= "Quotes use JSON escapes: \\"hello\\"."
`,
  roles: `ritual 1
Hiero: Welcome to the temple.
* Keryx Open the door.
All-officers: We are ready.
* All-except-hiero Rise.
@say hiero "Quoted speech."
@do keryx "Quoted action."
`,
  formatting: `ritual 1
= "An "
@b:
  = "important"
= " word, an "
@i:
  = "emphasized"
= " word, and a "
@a {"href":"https://example.com"}:
  = "link"
@ul:
  @li:
    = "First item"
  @li:
    = "Second item"
@ol:
  @li:
    = "First step"
@hr
`,
  variables: `ritual 1
@declareVar {"name":"candidate","label":"Candidate name","varType":"text","default":"Candidate"}
@declareVar {"name":"direction","label":"Direction","varType":"select","default":"east"}:
  @option {"value":"east","label":"East"}
  @option {"value":"west","label":"West"}
@task {"say":true,"role":"hiero"}:
  = "Welcome, "
  @var candidate
  = "."
@grade 0=0
`,
  notes: `ritual 1
@note:
  = "An explanatory note."
@todo:
  = "Check this wording."
= "A sentence with a reference"
@footnote:
  = "The reference text."
@footnotes
`,
  image: `ritual 1
@img {"src":"/image.svg","alt":"Describe the image","width":320}
`,
};
