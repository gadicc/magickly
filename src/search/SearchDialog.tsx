"use client";

import Close from "@mui/icons-material/Close";
import Search from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import { type LoadedSearchEngine, loadSearchEngine } from "./client";
import type { SearchResult } from "./types";

const SUGGESTIONS = [
  /*i18n*/ "Planetary hours",
  /*i18n*/ "Tree of Life",
  /*i18n*/ "Enochian calls",
  /*i18n*/ "Temple floor plans",
];

// Only app-owned responses become message IDs; network/provider details stay out of the UI.
const SEMANTIC_FAILURES = new Set([
  /*i18n*/ "Search request rejected.",
  /*i18n*/ "Enter between 2 and 300 characters.",
  /*i18n*/ "Search by meaning is unavailable. Text results are still shown.",
  /*i18n*/ "Search by meaning has reached today's limit. Text results are still shown.",
]);
const SEMANTIC_FAILED =
  /*i18n*/ "Search by meaning could not finish. Text results are still shown.";

/** A public search surface: keyboard navigation uses ordinary focusable links. */
export default function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t: translateUi } = useUiLanguage();

  const titleId = useId();
  const statusId = useId();
  const input = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [engine, setEngine] = useState<LoadedSearchEngine>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [semantic, setSemantic] = useState<{
    query: string;
    results: SearchResult[];
  }>();
  const [semanticError, setSemanticError] = useState("");
  const [semanticLoading, setSemanticLoading] = useState(false);
  const request = useRef<AbortController | null>(null);

  function changeQuery(value: string) {
    request.current?.abort();
    setSemanticLoading(false);
    setSemanticError("");
    setSemantic(undefined);
    setQuery(value.slice(0, 300));
  }

  useEffect(() => {
    if (!open) {
      request.current?.abort();
      setSemanticLoading(false);
    }
    return () => {
      request.current?.abort();
    };
  }, [open]);

  async function searchMeaning() {
    const text = query.trim();
    if (!engine?.semanticAvailable || text.length < 2 || semanticLoading)
      return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSemanticLoading(true);
    setSemanticError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) {
        if (!controller.signal.aborted)
          setSemanticError(
            SEMANTIC_FAILURES.has(body.message)
              ? body.message
              : SEMANTIC_FAILED,
          );
        return;
      }
      if (
        !controller.signal.aborted &&
        body.query === text &&
        Array.isArray(body.results)
      )
        setSemantic({ query: text, results: body.results });
    } catch {
      if (!controller.signal.aborted) setSemanticError(SEMANTIC_FAILED);
    } finally {
      if (!controller.signal.aborted) setSemanticLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the explicit retry trigger.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError("");
    loadSearchEngine().then(
      (ready) => {
        if (active) setEngine(ready);
      },
      () => {
        if (active)
          setError(
            /*i18n*/ "Search could not load. Connect to the internet and try again.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [open, attempt]);

  const results =
    semantic?.query === query.trim()
      ? semantic.results
      : (engine?.search(deferredQuery) ?? []);
  const waiting = !engine || query !== deferredQuery;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
      slotProps={{
        transition: { onEntered: () => input.current?.focus() },
        paper: {
          sx: {
            m: 2,
            width: "calc(100% - 32px)",
            alignSelf: "flex-start",
            mt: { xs: 3, sm: 10 },
          },
        },
      }}
    >
      <DialogTitle
        id={titleId}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <UiText message={/*i18n*/ "Search Magick.ly"} />
        <IconButton
          aria-label={translateUi(/*i18n*/ "Close search")}
          onClick={onClose}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary">
          <UiText
            message={
              /*i18n*/ "Search currently covers English pages. Use English words; results keep their original language."
            }
          />
        </Typography>
        <TextField
          autoFocus
          inputRef={input}
          label={translateUi(/*i18n*/ "Search pages and content")}
          placeholder={translateUi(/*i18n*/ "A name, a phrase, an idea…")}
          fullWidth
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter" && engine?.semanticAvailable) {
              event.preventDefault();
              void searchMeaning();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "Enter") {
              const first =
                resultsRef.current?.querySelector<HTMLAnchorElement>("a");
              if (first) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
            htmlInput: {
              "aria-describedby": statusId,
              dir: "auto",
              enterKeyHint: "search",
              maxLength: 300,
              autoComplete: "off",
              spellCheck: false,
            },
          }}
          sx={{ mt: 1 }}
        />
        {engine?.semanticAvailable ? (
          <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              disabled={query.trim().length < 2 || semanticLoading}
              onClick={() => void searchMeaning()}
            >
              <UiText
                message={
                  semanticLoading
                    ? /*i18n*/ "Finding related pages…"
                    : /*i18n*/ "Search by meaning"
                }
              />
            </Button>
          </Box>
        ) : null}
        {semanticError ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            {translateUi(semanticError)}
          </Alert>
        ) : null}
        {error ? (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <Button
                color="inherit"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <UiText message={/*i18n*/ "Retry"} />
              </Button>
            }
          >
            {translateUi(error)}
          </Alert>
        ) : null}
        <Typography
          id={statusId}
          variant="body2"
          color="textSecondary"
          role="status"
          sx={{ mt: 2 }}
        >
          {!query.trim()
            ? translateUi(
                /*i18n*/ "Explore the tools, names and texts on the site.",
              )
            : waiting
              ? translateUi(/*i18n*/ "Searching…")
              : results.length
                ? translateUi(
                    semantic?.query === query.trim()
                      ? /*i18n*/ "{count}{more} {count, plural, one {related page} other {related pages}}"
                      : /*i18n*/ "{count}{more} {count, plural, one {matching page} other {matching pages}}",
                    {
                      count: results.length,
                      more: results.length === 20 ? "+" : "",
                    },
                  )
                : translateUi(
                    /*i18n*/ "No matching pages. Try a shorter phrase or another spelling.",
                  )}
        </Typography>
        {!query.trim() ? (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2, mb: 1 }}>
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outlined"
                size="small"
                onClick={() => {
                  changeQuery(suggestion);
                  input.current?.focus();
                }}
              >
                {translateUi(suggestion)}
              </Button>
            ))}
          </Box>
        ) : null}
        <List
          ref={resultsRef}
          aria-label={translateUi(/*i18n*/ "Search results")}
          sx={{ mx: -1, opacity: query !== deferredQuery ? 0.6 : 1 }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const links = [
              ...(resultsRef.current?.querySelectorAll<HTMLAnchorElement>(
                "a",
              ) ?? []),
            ];
            const at = links.indexOf(
              document.activeElement as HTMLAnchorElement,
            );
            const next = event.key === "ArrowDown" ? at + 1 : at - 1;
            event.preventDefault();
            if (next < 0) input.current?.focus();
            else links[Math.min(next, links.length - 1)]?.focus();
          }}
        >
          {results.map((result) => (
            <li key={result.path}>
              <ListItemButton
                component={Link}
                href={result.href}
                prefetch={false}
                onClick={onClose}
                sx={{ alignItems: "flex-start", borderRadius: 1 }}
              >
                <ListItemText
                  lang="en"
                  dir="ltr"
                  disableTypography
                  primary={
                    <Typography sx={{ fontWeight: 500 }}>
                      {result.title}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      component="div"
                      variant="body2"
                      color="textSecondary"
                    >
                      {result.section ? (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ display: "block" }}
                          color="primary"
                        >
                          {result.section}
                        </Typography>
                      ) : null}
                      <span dir="auto">{result.excerpt}</span>
                    </Typography>
                  }
                />
              </ListItemButton>
            </li>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
