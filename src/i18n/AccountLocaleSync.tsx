"use client";
import { Alert, Button } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/auth/client";
import { isUuidV7 } from "@/lib/ids";
import { useUiLanguage } from "./LocaleProvider";
import { isUiLocale, LOCALE_COOKIE } from "./locales";
import {
  createPreferenceSync,
  type PendingLocale,
  type PreferenceSyncStatus,
} from "./preferenceSync";

const pendingKey = "magickly-pending-ui-locale";
function pendingChoice(): PendingLocale | null {
  try {
    const raw = sessionStorage.getItem(pendingKey) ?? "null";
    if (raw.length > 160) return null;
    const value = JSON.parse(raw);
    return value &&
      Object.keys(value).length === 2 &&
      isUuidV7(value.userId) &&
      isUiLocale(value.locale)
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Runs only behind the existing recovery gate and settled authentication flow. */
export default function AccountLocaleSync({ ready }: { ready: boolean }) {
  const session = useSession();
  const identity =
    !ready || session.isPending ? undefined : (session.data?.user.id ?? null);
  const { t } = useUiLanguage();
  const [status, setStatus] = useState<PreferenceSyncStatus>("idle");
  const controller = useRef<ReturnType<typeof createPreferenceSync> | null>(
    null,
  );
  useEffect(() => {
    const sync = createPreferenceSync({
      async read() {
        const response = await fetch("/api/ui-locale", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Preference unavailable");
        return response.json();
      },
      async save(value) {
        const response = await fetch("/api/ui-locale", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        const result = response.ok ? await response.json() : null;
        if (result?.userId !== value.userId || result?.locale !== value.locale)
          throw new Error("Preference not acknowledged");
      },
      pending: pendingChoice,
      persist(value) {
        try {
          if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value));
          else sessionStorage.removeItem(pendingKey);
          return true;
        } catch {
          return false;
        }
      },
      apply(locale) {
        // Hydration is not an explicit choice and must never write an account preference.
        document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        try {
          localStorage.setItem(LOCALE_COOKIE, locale);
        } catch {}
        window.dispatchEvent(
          new CustomEvent("magickly:locale-hydrate", { detail: locale }),
        );
      },
      status: setStatus,
    });
    controller.current = sync;
    const choice = (event: Event) => {
      const locale = (event as CustomEvent).detail;
      if (isUiLocale(locale)) sync.choose(locale);
    };
    const retry = () => {
      if (document.visibilityState !== "hidden") void sync.retry();
    };
    const signout = () => {
      void sync.settle(null);
    };
    window.addEventListener("magickly:locale-choice", choice);
    window.addEventListener("magickly:signout", signout);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      sync.dispose();
      controller.current = null;
      window.removeEventListener("magickly:locale-choice", choice);
      window.removeEventListener("magickly:signout", signout);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, []);
  useEffect(() => {
    void controller.current?.settle(identity);
  }, [identity]);
  return status === "failed" || status === "storage-failed" ? (
    <Alert
      data-nosnippet
      severity="warning"
      action={
        <Button
          color="inherit"
          onClick={() => void controller.current?.retry()}
        >
          {t(/*i18n*/ "Retry")}
        </Button>
      }
    >
      {status === "storage-failed"
        ? t(
            /*i18n*/ "This browser could not retain the language sync state. Keep this tab open and retry.",
          )
        : t(
            /*i18n*/ "This browser’s language was changed, but your account preference has not been saved. Retry when online.",
          )}
    </Alert>
  ) : null;
}
