"use client";
import { Clear } from "@mui/icons-material";

import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import RoseSigil from "magick-components/gd/RoseSigil";
import {
  DEFAULT_ROSE_VERSION,
  ROSE_LETTERS,
  ROSE_VERSION_NOTES,
  ROSE_VERSIONS,
  type RoseVersionId,
} from "magick-components/gd/roseSigilGeometry";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "magick-components/gd/roseSigilLayout";
import { sigilFigure } from "magick-components/sigil/SigilImage";
import React from "react";
import { VersionNote, VersionSelect } from "@/drawings/DrawingVersion";
import Ink from "@/drawings/Ink";
import ToolLayout, {
  ToolControls,
  ToolDrawing,
  ToolPanel,
} from "@/drawings/ToolLayout";
import ExportControls from "@/export/ExportControls";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import { parseComponentImageRequest } from "@/render/componentImageRequest";
import {
  canonicalSigilText,
  foldFinalForms,
  SIGIL_MAX_LETTERS,
} from "@/render/contracts/roseSigil";
import DebugSigil from "./DebugSigil";

// Link stays in the export rows while there is no sigil, and says why.
const NO_SIGIL_LINK = /*i18n*/ "No image link until a sigil is drawn.";

export default function Sigils({
  initial,
}: {
  initial: { text: string; rose: boolean; version: RoseVersionId };
}) {
  const { t } = useUiLanguage();
  const ref = React.useRef<SVGSVGElement>(null);
  const [sigilText, setSigilText] = React.useState(initial.text);
  const [showRose, setShowRose] = React.useState(initial.rose);
  const [version, setVersion] = React.useState(initial.version);
  const [animate, setAnimate] = React.useState(true);
  const [showKeys, setShowKeys] = React.useState(false);
  const [debug, setDebug] = React.useState(false);

  // Final forms are traced at their ordinary letters' places (F5), so the
  // text is checked with them folded and drawn as typed.
  const folded = foldFinalForms(sigilText);

  // Whitespace separates words, each its own sigil (plan 088, R2).
  const charsValid = folded
    .split("")
    .map(
      (letter) =>
        /\s/.test(letter) || ROSE_LETTERS.some((ring) => ring.includes(letter)),
    );
  // As many rose letters as the image contract takes: a longer text is
  // not drawn, which also bounds the work of placing it.
  const letterCount = charsValid.filter(
    (valid, i) => valid && !/\s/.test(folded[i]),
  ).length;
  const tooLong = letterCount > SIGIL_MAX_LETTERS;
  const isValid = charsValid.indexOf(false) === -1 && !tooLong;
  const drawn = isValid ? sigilText : "";
  // The text as links and file names carry it: words spelled with their
  // final forms, as the image contract keeps them.
  const canonical = (isValid && canonicalSigilText(sigilText)) || "";

  // Words beyond the tested domain are drawn best effort; the engine says
  // when a figure fails its own checks, and the page says so too. The
  // engine keeps every word it places (keyed by the budget it was given,
  // so the same text always gets the same figure), so RoseSigil's own
  // placement of this text finds each word already placed.
  const unclear = React.useMemo(
    () =>
      sigilFigure(
        drawn,
        roseSigilLayout(version),
        ROSE_SIGIL_PROFILE,
      ).failures.some((failures) => failures.length > 0),
    [drawn, version],
  );

  // Links only exist for text the server contract accepts, which collapses
  // the whitespace between words; the text is the user's own, so the
  // controls say so and nothing is written to the URL.
  const link = (() => {
    if (!canonical) return undefined;
    try {
      const params = new URLSearchParams({ text: canonical });
      if (!showRose) params.set("rose", "false");
      if (version !== DEFAULT_ROSE_VERSION) params.set("version", version);
      return {
        slug: "rose-sigil" as const,
        props: parseComponentImageRequest("rose-sigil", params).props,
      };
    } catch {
      return undefined;
    }
  })();
  const share = link
    ? () => {
        const params = new URLSearchParams({ text: link.props.text });
        if (!link.props.rose) params.set("rose", "false");
        if (link.props.version && link.props.version !== DEFAULT_ROSE_VERSION)
          params.set("version", link.props.version);
        return `/gd/sigils?${params}`;
      }
    : undefined;

  return (
    <ToolLayout>
      <ToolControls>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <TextField
            placeholder={t(/*i18n*/ "Sigil text")}
            size="small"
            value={sigilText}
            dir="rtl"
            lang="he"
            onChange={(e) => setSigilText(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => {
                        setSigilText("");
                      }}
                    >
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <VersionSelect
            id="rose-version-select"
            size="small"
            versions={ROSE_VERSIONS}
            notes={ROSE_VERSION_NOTES}
            defaultVersion={DEFAULT_ROSE_VERSION}
            value={version}
            onChange={setVersion}
          />
        </Box>
        <div>
          <UiText
            message={
              /*i18n*/ "Separate words with spaces: each word is its own sigil, drawn right to left."
            }
          />
        </div>
        {/* "Invalid characters:", a label search has always read as the
            page's prose, goes through UiRichText, the adapter it reads
            (src/search). */}
        {tooLong && (
          <div>
            <UiText
              message={
                /*i18n*/ "A sigil takes at most {max} letters; this text has {count}."
              }
              values={{ max: SIGIL_MAX_LETTERS, count: letterCount }}
            />
          </div>
        )}
        {charsValid.includes(false) && (
          <div>
            <UiRichText message={/*i18n*/ "Invalid characters:"} />{" "}
            {charsValid.map((valid, i) => (
              <span key={i} style={{ color: valid ? "" : "red" }}>
                {sigilText[i]}
              </span>
            ))}
          </div>
        )}
        <FormGroup>
          <Stack direction="row" sx={{ flexWrap: "wrap" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showRose}
                  onChange={() => setShowRose(!showRose)}
                />
              }
              label={<UiText message={/*i18n*/ "Show Rose"} />}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={animate}
                  onChange={() => setAnimate(!animate)}
                />
              }
              label={<UiText message={/*i18n*/ "Animate"} />}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showKeys}
                  onChange={() => setShowKeys(!showKeys)}
                />
              }
              label={<UiText message={/*i18n*/ "Show Keys"} />}
            />
            <FormControlLabel
              control={
                <Checkbox checked={debug} onChange={() => setDebug(!debug)} />
              }
              label={<UiText message={/*i18n*/ "Debug"} />}
            />
          </Stack>
        </FormGroup>

        {showKeys && (
          <div style={{ direction: "rtl" }}>
            {"אבגדהוזחטיכךלמםנןסעפףצץקרשת←".split("").map((letter, i) => (
              <button
                key={i}
                style={{ margin: "1px" }}
                onClick={() => {
                  if (letter === "←") setSigilText(sigilText.slice(0, -1));
                  else setSigilText(sigilText + letter);
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
      </ToolControls>
      <ToolDrawing>
        <Ink drawing="roseSigil">
          {debug ? (
            <DebugSigil
              ref={ref}
              text={drawn}
              showRose={showRose}
              version={version}
            />
          ) : (
            <RoseSigil
              ref={ref}
              text={drawn}
              showRose={showRose}
              version={version}
              animate={animate}
            />
          )}
        </Ink>
        {unclear && (
          <div>
            <UiText
              message={
                /*i18n*/ "This sigil could not be drawn so that every mark stands clear; it may be hard to read."
              }
            />
          </div>
        )}
      </ToolDrawing>
      <ToolPanel>
        <ExportControls
          target={ref}
          filename={`RoseSigil-${canonical.split(" ").join("-")}${version === DEFAULT_ROSE_VERSION ? "" : `-${version}`}`}
          link={link}
          linkNote={link ? undefined : t(NO_SIGIL_LINK)}
          share={share}
        />
        <VersionNote
          note={ROSE_VERSION_NOTES[version]}
          headingId="rose-version"
        />
      </ToolPanel>
    </ToolLayout>
  );
}
