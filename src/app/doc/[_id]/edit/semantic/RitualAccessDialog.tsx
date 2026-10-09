"use client";

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import * as React from "react";
import { type RitualScope, sameScope } from "@/doc/access";
import type { SqlRitualAccessSettings } from "@/doc/sqlScope";
import { changeRitualAccess, loadRitualAccess } from "./accessActions";

function choiceOf(scope: RitualScope) {
  return scope.kind === "public"
    ? "public"
    : scope.kind === "temple"
      ? `temple:${scope.templeId}`
      : `group:${scope.groupId}`;
}

function describe(settings: SqlRitualAccessSettings) {
  const { scope, scopeName } = settings;
  if (scope.kind === "public") return "Everyone, signed in or not.";
  if (scope.kind === "group")
    return `Members of the group ${scopeName || "(unnamed)"}.`;
  return `Members of ${scopeName || "this temple"} at grade ${scope.minGrade} and above, and its administrators.`;
}

/**
 * Who can read a ritual, for its editors. Everything shown and every choice is
 * re-checked by the server; this only keeps the form honest about what exists.
 */
export default function RitualAccessDialog({
  ritualId,
  actorId,
  open,
  onClose,
}: {
  ritualId: string;
  actorId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] =
    React.useState<SqlRitualAccessSettings | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [choice, setChoice] = React.useState("");
  const [minGrade, setMinGrade] = React.useState(0);
  const [understood, setUnderstood] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const adopt = React.useCallback((next: SqlRitualAccessSettings) => {
    setSettings(next);
    setChoice(choiceOf(next.scope));
    setMinGrade(next.scope.kind === "temple" ? next.scope.minGrade : 0);
    setUnderstood(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setMessage(null);
    loadRitualAccess(ritualId)
      .then((next) => {
        if (!current) return;
        if (next) adopt(next);
        else
          setMessage({
            severity: "error",
            text: "Who can read this ritual could not be loaded.",
          });
      })
      .catch(() => {
        if (current)
          setMessage({
            severity: "error",
            text: "Who can read this ritual could not be loaded.",
          });
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, ritualId, adopt]);

  const options = settings?.options;
  const choices = options
    ? [
        ...(options.public
          ? [{ value: "public", label: "Everyone, signed in or not" }]
          : []),
        ...options.temples.map((temple) => ({
          value: `temple:${temple.id}`,
          label: `Members of ${temple.name}`,
        })),
        ...options.groups.map((group) => ({
          value: `group:${group.id}`,
          label: `Members of the group ${group.name}`,
        })),
      ]
    : [];
  // The current scope may be one this editor does not administer.
  const current = settings ? choiceOf(settings.scope) : "";
  const known = choices.some((item) => item.value === current);
  const editable = choices.length > 0;
  const toTemple = choice.startsWith("temple:");
  const toPublic = choice === "public";
  const gradeValid = Number.isSafeInteger(minGrade) && minGrade >= 0;

  const nextScope = (): RitualScope | null => {
    if (toPublic) return { kind: "public" };
    if (toTemple)
      return gradeValid
        ? { kind: "temple", templeId: choice.slice(7), minGrade }
        : null;
    if (choice.startsWith("group:"))
      return { kind: "group", groupId: choice.slice(6) };
    return null;
  };
  const scope = nextScope();
  const unchanged = !!settings && !!scope && sameScope(settings.scope, scope);
  const widening = toPublic && settings?.scope.kind !== "public";

  const save = async () => {
    if (!scope || !settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await changeRitualAccess({
        ritualId,
        expectedActorId: actorId,
        scope,
      });
      if (result.ok) {
        const refreshed = await loadRitualAccess(ritualId);
        if (refreshed) {
          adopt(refreshed);
          setMessage({ severity: "success", text: "Saved." });
        } else {
          // The change itself may have ended this editor's own access.
          setSettings(null);
          setMessage({
            severity: "success",
            text: "Saved. You can no longer see or change who can read this ritual.",
          });
        }
      } else setMessage({ severity: "error", text: result.message });
    } catch {
      setMessage({
        severity: "error",
        text: "The change could not be saved. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="ritual-access-title"
    >
      <DialogTitle id="ritual-access-title">
        Who can read this ritual
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {loading && <Typography>Loading…</Typography>}
          {settings && (
            <>
              <Typography>
                <strong>{settings.title}</strong> can currently be read by:{" "}
                {describe(settings)}
              </Typography>
              {!editable && (
                <Alert severity="info">
                  Only administrators of a temple or group can change this.
                </Alert>
              )}
              {editable && (
                <>
                  <TextField
                    select
                    label="Readable by"
                    size="small"
                    value={choice}
                    onChange={(event) => {
                      setChoice(event.target.value);
                      setUnderstood(false);
                      setMessage(null);
                    }}
                  >
                    {!known && (
                      <MenuItem value={current} disabled>
                        {describe(settings)}
                      </MenuItem>
                    )}
                    {choices.map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {toTemple && (
                    <TextField
                      label="Minimum grade"
                      size="small"
                      type="number"
                      value={minGrade}
                      error={!gradeValid}
                      helperText={
                        gradeValid
                          ? "Members at this grade or above can read it. 0 is every member."
                          : "Enter a whole number, 0 or more."
                      }
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                      onChange={(event) =>
                        setMinGrade(Number(event.target.value))
                      }
                    />
                  )}
                  {widening && (
                    <Alert severity="warning">
                      Everyone, including people who are not signed in, will be
                      able to read this ritual, and search engines may list it.
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={understood}
                            onChange={(event) =>
                              setUnderstood(event.target.checked)
                            }
                          />
                        }
                        label="I understand"
                      />
                    </Alert>
                  )}
                  {!widening && !unchanged && scope && (
                    <Alert severity="info">
                      Anyone who no longer qualifies loses access at once.
                      Copies downloaded to their devices are deleted when those
                      devices next check in with the server, or within 14 days
                      at the latest.
                      {choice.startsWith("group:") &&
                        " The person who created the ritual keeps access to it whether or not they are in that group."}
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
          {message && <Alert severity={message.severity}>{message.text}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {editable && (
          <Button
            variant="contained"
            onClick={save}
            disabled={
              saving ||
              loading ||
              !scope ||
              unchanged ||
              (widening && !understood)
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
