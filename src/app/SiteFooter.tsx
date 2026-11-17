"use client";
import { Box, Typography } from "@mui/material";
import NextLink from "next/link";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { publicEdition } from "@/i18n/publications";
import { SITE_FORUM } from "@/seo/site";
import pathnames from "./pathnames";
import { footerSections, type NavLink, showsFooter } from "./siteNav";
import useSiteNav from "./useSiteNav";

/** The site's own pages, after the sections; titles from `pathnames.ts`. */
const SITE_LINKS: NavLink[] = [
  { title: pathnames.about as string, url: "/about" },
  { title: pathnames.study as string, url: "/study" },
  { title: pathnames.chat as string, url: "/chat" },
  { title: /*i18n*/ "Temples guide", url: "/help/temples" },
  { title: /*i18n*/ "Ritual Pug guide", url: "/help/ritual-pug" },
  { title: /*i18n*/ "Forum", url: SITE_FORUM },
];

const linkStyle = { color: "inherit", textDecoration: "none" } as const;

function FooterLink({
  link,
  current,
}: {
  link: NavLink;
  current: "page" | "true" | undefined;
}) {
  const { t, locale } = useUiLanguage();
  const external = /^https?:/.test(link.url);
  return (
    <Box component="li" sx={{ py: 0.25 }}>
      {external ? (
        <a href={link.url} style={linkStyle}>
          {t(link.title)}
        </a>
      ) : (
        <NextLink
          href={publicEdition(link.url, locale) ?? link.url}
          style={linkStyle}
          aria-current={current}
        >
          {t(link.title)}
        </NextLink>
      )}
    </Box>
  );
}

/**
 * Links to every public section and its pages, below each page's own
 * content: what readers look for once they reach the end, and the links
 * search engines follow between the site's pages (plan 071, decision 3).
 * It renders on the server like the app bar, from the same path, and stays
 * off full-screen and members' pages.
 */
/** Whether a footer link is the page, the section the page is in, or neither. */
function currentOf(path: string, url: string) {
  if (path === url) return "page" as const;
  if (url !== "/" && path.startsWith(`${url}/`)) return "true" as const;
  return undefined;
}

export default function SiteFooter() {
  const { t, locale } = useUiLanguage();
  // `path` is the 404's own path wherever it is served, so the server and
  // the browser decide alike.
  const { path } = useSiteNav();
  if (!showsFooter(path)) return null;

  const column = (heading: NavLink, links: NavLink[]) => (
    <Box key={heading.url}>
      <Typography
        component="h2"
        sx={{ fontSize: "0.95rem", fontWeight: 600, mb: 0.5 }}
      >
        <NextLink
          href={publicEdition(heading.url, locale) ?? heading.url}
          style={linkStyle}
          aria-current={currentOf(path, heading.url)}
        >
          {t(heading.title)}
        </NextLink>
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {links.map((link) => (
          <FooterLink
            key={link.url}
            link={link}
            current={currentOf(path, link.url)}
          />
        ))}
      </Box>
    </Box>
  );

  return (
    <Box
      component="footer"
      sx={[
        {
          mt: 6,
          px: 2,
          pt: 3,
          pb: 4,
          bgcolor: "grey.100",
          borderTop: 1,
          borderColor: "divider",
          color: "text.secondary",
          fontSize: "0.9rem",
          displayPrint: "none",
          "& a:hover, & a:focus-visible": {
            color: "primary.dark",
            textDecoration: "underline",
          },
        },
        // A band on the dark page too, and links that brighten on hover:
        // the dark scheme's `primary.dark` is dimmer than the text.
        (theme) =>
          theme.applyStyles("dark", {
            bgcolor: "background.paper",
            "& a:hover, & a:focus-visible": {
              color: "primary.main",
            },
          }),
      ]}
    >
      <Box
        component="nav"
        aria-label={t(/*i18n*/ "Site")}
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 2,
          maxWidth: 960,
          mx: "auto",
        }}
      >
        {footerSections().map((section) => column(section, section.pages))}
        {column({ title: "Magick.ly", url: "/" }, SITE_LINKS)}
      </Box>
    </Box>
  );
}
