"use client";
import { type Messages, setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { messages as english } from "@/locales/en/messages.js";
import { loadCatalog } from "./catalogs";
import {
  isUiLocale,
  LOCALE_COOKIE,
  LOCALE_INFO,
  preferredLocale,
  type UiLocale,
} from "./locales";

export type LocalePolicy = "public" | "private" | "offline";

interface UiLanguage {
  locale: UiLocale;
  policy: LocalePolicy;
  changing: boolean;
  error: "catalog" | "storage" | null;
  t(message: string, values?: Record<string, string | number>): string;
  choose(locale: UiLocale): Promise<boolean>;
}

// Fixed English fallback for isolated components/tests. Never activated or mutated.
const fallback = setupI18n({ locale: "en", messages: { en: english } });
const UiContext = createContext<UiLanguage>({
  locale: "en",
  policy: "public",
  changing: false,
  error: null,
  t: (message, values) => fallback._(message, values),
  choose: async () => false,
});

export function useUiLanguage() {
  return useContext(UiContext);
}

/** Read only our locale cookie; no account identity or stored ritual data is involved. */
export function browserUiLocale(): UiLocale {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return preferredLocale(
    raw,
    navigator.languages?.join(",") || navigator.language,
  );
}

/** An explicit action saves the browser choice immediately, independently of account sync. */
export function saveBrowserUiLocale(locale: UiLocale) {
  let durable = false;
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    durable = document.cookie
      .split(";")
      .some((part) => part.trim() === `${LOCALE_COOKIE}=${locale}`);
  } catch {}
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {}
  window.dispatchEvent(
    new CustomEvent("magickly:locale-choice", { detail: locale }),
  );
  return durable;
}

/** One mounted instance; catalog/direction switches keep editors and recovery providers mounted. */
export default function LocaleProvider({
  locale: initial,
  messages,
  policy = "public",
  children,
}: {
  locale: UiLocale;
  messages: Messages;
  policy?: LocalePolicy;
  children: ReactNode;
}) {
  const [i18n] = useState(() =>
    setupI18n({ locale: initial, messages: { [initial]: messages } }),
  );
  const [locale, setLocale] = useState(initial);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<UiLanguage["error"]>(null);
  const [ready, setReady] = useState(policy !== "offline");
  const revision = useRef(0);
  const mounted = useRef(true);
  const router = useRouter();
  const refreshOnReconnect = useRef(false);
  const activate = useCallback(
    async (next: UiLocale, refresh: boolean) => {
      const request = ++revision.current;
      setChanging(true);
      setError(null);
      try {
        const catalog = await loadCatalog(next);
        if (!mounted.current || request !== revision.current) return false;
        i18n.loadAndActivate({ locale: next, messages: catalog });
        setLocale(next);
        if (refresh) {
          if (navigator.onLine) router.refresh();
          else refreshOnReconnect.current = true;
        }
        return true;
      } catch {
        if (mounted.current && request === revision.current)
          setError("catalog");
        return false;
      } finally {
        if (mounted.current && request === revision.current) setChanging(false);
      }
    },
    [i18n, router],
  );
  const choose = useCallback(
    async (next: UiLocale) => {
      if (!isUiLocale(next)) return false;
      // Failed catalog loads keep the current UI and saved preference intact.
      if (policy !== "public" && !(await activate(next, false))) return false;
      if (!saveBrowserUiLocale(next)) setError("storage");
      if (policy !== "public") {
        if (navigator.onLine) router.refresh();
        else refreshOnReconnect.current = true;
      }
      return true;
    },
    [activate, policy, router],
  );
  useLayoutEffect(() => {
    // Refresh can merge older server document attributes while this mounted
    // provider retains a newer explicit choice. Reapply after every commit.
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_INFO[locale].direction;
  });
  useEffect(() => {
    mounted.current = true;
    if (policy === "offline")
      void activate(browserUiLocale(), false).finally(() => {
        if (mounted.current) setReady(true);
      });
    const apply = (event: Event) => {
      const next = (event as CustomEvent).detail;
      // Account preference hydration never changes a public URL's language.
      if (policy !== "public" && isUiLocale(next)) void activate(next, true);
    };
    const storage = (event: StorageEvent) => {
      if (
        policy !== "public" &&
        event.key === LOCALE_COOKIE &&
        isUiLocale(event.newValue)
      )
        void activate(event.newValue, true);
    };
    const online = () => {
      if (refreshOnReconnect.current) {
        refreshOnReconnect.current = false;
        router.refresh();
      }
    };
    window.addEventListener("magickly:locale-hydrate", apply);
    window.addEventListener("storage", storage);
    window.addEventListener("online", online);
    return () => {
      mounted.current = false;
      revision.current++;
      window.removeEventListener("magickly:locale-hydrate", apply);
      window.removeEventListener("storage", storage);
      window.removeEventListener("online", online);
    };
  }, [activate, policy, router]);
  return (
    <I18nProvider i18n={i18n}>
      <UiContext.Provider
        value={{
          locale,
          policy,
          changing,
          error,
          choose,
          t: (message, values) => i18n._(message, values),
        }}
      >
        {error === "storage" && (
          <p role="alert" data-nosnippet>
            {i18n._(
              /*i18n*/ "The language changed in this tab, but this browser could not save the preference.",
            )}
          </p>
        )}
        {ready ? children : <p role="status">Opening offline library…</p>}
      </UiContext.Provider>
    </I18nProvider>
  );
}
