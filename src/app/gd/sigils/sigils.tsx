"use client";
import { Clear } from "@mui/icons-material";

import {
  Box,
  Checkbox,
  Container,
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
import React from "react";
import { VersionNote, VersionSelect } from "@/drawings/DrawingVersion";
import Ink from "@/drawings/Ink";
import ExportControls from "@/export/ExportControls";
import { parseComponentImageRequest } from "@/render/componentImageRequest";
import { rectifySigilText } from "@/render/contracts/roseSigil";
import DebugSigil from "./DebugSigil";

export default function Sigils({
  initial,
}: {
  initial: { text: string; rose: boolean; version: RoseVersionId };
}) {
  const ref = React.useRef<SVGSVGElement>(null);
  const [sigilText, setSigilText] = React.useState(initial.text);
  const [showRose, setShowRose] = React.useState(initial.rose);
  const [version, setVersion] = React.useState(initial.version);
  const [animate, setAnimate] = React.useState(true);
  const [showKeys, setShowKeys] = React.useState(false);
  const [debug, setDebug] = React.useState(false);

  const rectified = rectifySigilText(sigilText);

  const charsValid = rectified
    .split("")
    .map((letter) => ROSE_LETTERS.some((ring) => ring.includes(letter)));
  const isValid = charsValid.indexOf(false) === -1;

  // Links only exist for text the server contract accepts; the text is the
  // user's own, so the controls say so and nothing is written to the URL.
  const link = (() => {
    if (!isValid || !rectified) return undefined;
    try {
      const params = new URLSearchParams({ text: rectified });
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
    <div>
      <Container sx={{ py: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <TextField
            placeholder="Sigil text"
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
        {!isValid && (
          <div>
            Invalid characters:{" "}
            {charsValid.map((valid, i) => (
              <span key={i} style={{ color: valid ? "" : "red" }}>
                {sigilText[i]}
              </span>
            ))}
          </div>
        )}
        <FormGroup>
          <Stack direction="row">
            <FormControlLabel
              control={
                <Checkbox
                  checked={showRose}
                  onChange={() => setShowRose(!showRose)}
                />
              }
              label="Show Rose"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={animate}
                  onChange={() => setAnimate(!animate)}
                />
              }
              label="Animate"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showKeys}
                  onChange={() => setShowKeys(!showKeys)}
                />
              }
              label="Show Keys"
            />
            <FormControlLabel
              control={
                <Checkbox checked={debug} onChange={() => setDebug(!debug)} />
              }
              label="Debug"
            />
          </Stack>
        </FormGroup>

        {rectified != sigilText && <div>Rectified text: {rectified}</div>}

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

        <Ink drawing="roseSigil">
          {debug ? (
            <DebugSigil
              ref={ref}
              text={isValid ? rectified : ""}
              showRose={showRose}
              version={version}
            />
          ) : (
            <RoseSigil
              ref={ref}
              text={isValid ? rectified : ""}
              showRose={showRose}
              version={version}
              animate={animate}
            />
          )}
        </Ink>
        <ExportControls
          target={ref}
          filename={`RoseSigil-${rectified}${version === DEFAULT_ROSE_VERSION ? "" : `-${version}`}`}
          link={link}
          share={share}
        />
        <VersionNote
          note={ROSE_VERSION_NOTES[version]}
          headingId="rose-version"
        />
      </Container>
    </div>
  );
}
