"use client";
import useHydrated from "@magick-components/hooks/useHydrated";
import {
  AccountCircle,
  ArrowDropDown,
  ArrowDropUp,
  ExpandLess,
  ExpandMore,
  Login,
  Menu as MenuIcon,
  Share,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Slide,
  Toolbar,
  Typography,
  useScrollTrigger,
} from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
// By alias, not "./ThemeSwitch": site search follows a page's relative
// imports (scripts/search/prose.ts), and /chat imports this file, so a
// relative import would put the switch's "Theme" into the chat page's prose.
import ThemeSwitch from "@/app/ThemeSwitch";
import { sqlBrowserLifecycle } from "@/auth/browserLifecycle";
import { useSession } from "@/auth/client";
import SearchButton from "@/search/SearchButton";
// import Link from "@magick-components/Link";
import { useLegacyRecoveryGate } from "./clientProviders";
import pathnames from "./pathnames";
import type { NavLink } from "./siteNav";
import useSiteNav from "./useSiteNav";

function SignInButton({
  callbackURL,
  disabled,
}: {
  callbackURL: string;
  disabled: boolean;
}) {
  return (
    <IconButton
      aria-label="sign in"
      component={Link}
      disabled={disabled}
      href={`/signin?callbackURL=${encodeURIComponent(callbackURL)}`}
      // The bar's text colour: white on the light scheme's blue bar and on
      // the dark scheme's navy one.
      sx={{ color: "inherit" }}
    >
      <Login />
    </IconButton>
  );
}

/**
 * The only part of the bar that needs the query. Static pages render the
 * rest on the server and this one after hydration.
 */
function SignInWithQuery({
  pathname,
  disabled,
}: {
  pathname: string;
  disabled: boolean;
}) {
  const query = useSearchParams()?.toString();
  return (
    <SignInButton
      callbackURL={`${pathname}${query ? `?${query}` : ""}`}
      disabled={disabled}
    />
  );
}

function HideOnScroll({ children }) {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children ?? <div />}
    </Slide>
  );
}

export function UserAvatar({
  sx,
}: {
  sx?: Parameters<typeof Avatar>[0]["sx"];
}) {
  const session = useSession();
  const user = session.data?.user;
  const avatarSrc = user?.image;

  return avatarSrc ? (
    <Avatar
      alt={user?.name || "avatar"}
      src={avatarSrc}
      sx={sx}
      slotProps={{
        img: {
          referrerPolicy: "no-referrer",
        },
      }}
    />
  ) : (
    <Avatar sx={sx}>
      <AccountCircle />
    </Avatar>
  );
}

/**
 * The drawer's links. A click anywhere in them closes the drawer. The drawer's
 * paper is a flex column: they take its height and scroll, and the theme
 * switch sits below them.
 */
function MenuLinks({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  const [open, setOpen] = React.useState("");

  return (
    <Box
      onClick={handleDrawerToggle}
      sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}
    >
      <Typography variant="h6" sx={{ my: 2, mx: 2, textAlign: "left" }}>
        {/*
          Dark artwork on transparent, so in dark it sits on a light plate.
          The plate's padding is taken back from the margins, so the header
          keeps its layout; light gets no rule at all.
        */}
        <Box
          component={Image}
          src="/pentagram.png"
          alt="Pentagram"
          width={32}
          height={32}
          sx={[
            { verticalAlign: "middle", marginRight: "12px" },
            (theme) =>
              theme.applyStyles("dark", {
                boxSizing: "content-box",
                bgcolor: "plate",
                borderRadius: "50%",
                padding: "3px",
                margin: "-3px 9px -3px -3px",
              }),
          ]}
        />
        <span style={{ verticalAlign: "middle" }}>Magick.ly</span>
      </Typography>
      <Divider />
      <List>
        {Object.entries(pathnames)
          .filter(([key, value]) => {
            // TODO, hooks to check access.
            if (key === "admin") return false;
            return true;
          })
          .map(([key, value]) =>
            typeof value === "string" || Object.keys(value).length === 2 ? (
              <ListItem key={key} disablePadding>
                <ListItemButton
                  component={Link}
                  href={key === "/" ? "/" : "/" + key}
                >
                  <ListItemText
                    primary={
                      value === "Magick.ly"
                        ? "Home"
                        : typeof value === "string"
                          ? value
                          : value["/"]
                    }
                  />
                </ListItemButton>
              </ListItem>
            ) : (
              <React.Fragment key={key}>
                <ListItemButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(key === open ? "" : key);
                  }}
                >
                  <ListItemText primary={value["/"]} />
                  {open === key ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={open === key} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {Object.entries(value)
                      .filter(([key, value]) => {
                        if (key === "/") return false;
                        // if (typeof value !== "string") return false;
                        return true;
                      })
                      .map(([key2, value]) => (
                        <ListItemButton
                          key={key2}
                          sx={{ pl: 4 }}
                          component={Link}
                          href={"/" + key + (key2 === "/" ? "" : "/" + key2)}
                        >
                          <ListItemText
                            primary={
                              typeof value === "string" ? value : value["/"]
                            }
                          />
                        </ListItemButton>
                      ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ),
          )}
      </List>
    </Box>
  );
}

/** Choosing a theme is outside the links' box, so it keeps the drawer open. */
function MenuDrawer({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  return (
    <>
      <MenuLinks handleDrawerToggle={handleDrawerToggle} />
      <ThemeSwitch />
    </>
  );
}

/** Indent per level of the menu's trail. */
const MENU_INDENT = 9;

/**
 * Between the trail's sections. A constant, not literal text, so that site
 * search, which indexes pages' literal JSX, leaves it out (`src/search`).
 */
const TRAIL_SEPARATOR = "›";

/**
 * The sections above the page, beside its title, where the bar is wide
 * enough (MUI's `sm`, 600 px). Phones show the title and the menu's arrow.
 */
function InlineTrail({ trail }: { trail: NavLink[] }) {
  return (
    <Box
      component="nav"
      aria-label="Breadcrumb"
      sx={{
        display: { xs: "none", sm: "block" },
        // The title keeps its room; the trail gives way first.
        flexShrink: 3,
        minWidth: 0,
        maxWidth: "50%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        typography: "h6",
        height: "1.5em",
      }}
    >
      <Box
        component="ol"
        sx={{ display: "inline", listStyle: "none", m: 0, p: 0 }}
      >
        {trail.map((link) => (
          <Box component="li" key={link.url} sx={{ display: "inline" }}>
            <NextLink
              href={link.url}
              style={{
                color: "rgba(255, 255, 255, 0.78)",
                textDecoration: "none",
              }}
            >
              {link.title}
            </NextLink>
            <Box
              component="span"
              aria-hidden
              sx={{ mx: 0.75, color: "rgba(255, 255, 255, 0.6)" }}
            >
              {TRAIL_SEPARATOR}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * The title's menu: Home, the sections above, the page, then the other
 * pages of its section. Kept mounted and in place (not portalled), so its
 * links are in the server HTML for search engines; closed, MUI hides it
 * with `visibility: hidden`, out of the tab order and the accessibility
 * tree. It sits outside the bar, whose slide transform would otherwise
 * become the fixed menu's containing block.
 */
function NavMenu({
  anchorEl,
  onClose,
  ancestors,
  current,
  sectionPages,
  nested,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  ancestors: NavLink[];
  current: { title: string; url?: string } | null;
  sectionPages: NavLink[];
  nested: boolean;
}) {
  const trail = [{ title: "Home", url: "/" }, ...ancestors];
  const level = trail.length;
  return (
    <Menu
      id="nav-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      keepMounted
      disablePortal
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      sx={{ marginTop: 0.5, marginLeft: -1.8 }}
      // Links straight in the menu, not inside list items: a div, not a ul.
      slotProps={{ list: { component: "div" } }}
    >
      {trail.map((link, i) => (
        <MenuItem
          key={link.url}
          component={NextLink}
          href={link.url}
          onClick={onClose}
          sx={{ pl: `${16 + MENU_INDENT * i}px` }}
        >
          {link.title}
        </MenuItem>
      ))}
      {current?.url ? (
        // A page below the entry that titles it: the entry, as a link.
        <MenuItem
          component={NextLink}
          href={current.url}
          onClick={onClose}
          sx={{ pl: `${16 + MENU_INDENT * level}px` }}
        >
          {current.title}
        </MenuItem>
      ) : current ? (
        <MenuItem
          component="div"
          aria-current="page"
          onClick={onClose}
          sx={[
            { pl: `${16 + MENU_INDENT * level}px`, color: "red" },
            // Pure red is dim on the dark menu's paper (#323843): the
            // ritual roles' light red reads at 4.67:1 there.
            (theme) =>
              theme.applyStyles("dark", {
                color: "#ff7a7a",
              }),
          ]}
        >
          {current.title}
        </MenuItem>
      ) : null}
      {sectionPages.length ? <Divider /> : null}
      {sectionPages.map((link) => (
        <MenuItem
          key={link.url}
          component={NextLink}
          href={link.url}
          onClick={onClose}
          // A section page's own pages sit below it; siblings beside it.
          sx={{ pl: `${16 + MENU_INDENT * (nested ? level + 1 : level)}px` }}
        >
          {link.title}
        </MenuItem>
      ))}
    </Menu>
  );
}

/**
 * Characters past which a title may not fit a 360 px phone's bar at 20 px.
 * A count stands in for a measurement, so a few titles that would fit,
 * such as "Shem HaMephorash", are set smaller too.
 */
const LONG_TITLE = 15;

export default function ButtonAppBar() {
  const {
    pathname,
    title,
    known,
    ancestors,
    sectionPages,
    childPages,
    titleUrl,
  } = useSiteNav();
  // A page with no title of its own (an angel, a Sephirah) is labelled with
  // the section it sits in; its own heading names it.
  const label = known ? title : (ancestors.at(-1)?.title ?? title);
  const trail = known ? ancestors : ancestors.slice(0, -1);
  const hasMenu = ancestors.length > 0 || sectionPages.length > 0;
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const session = useSession();
  // The server renders signed out. A cached session can be known on the
  // first client render, which would hydrate a different tree; match the
  // server until hydration.
  const hydrated = useHydrated();
  const userId = hydrated ? (session.data?.user.id ?? null) : null;
  const recovery = useLegacyRecoveryGate();
  const [signOutPending, setSignOutPending] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [navAnchorEl, setNavAnchorEl] = React.useState<null | HTMLElement>(
    null,
  );
  // Back or forward with the menu open can replace its anchor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes on navigation
  React.useEffect(() => setNavAnchorEl(null), [pathname]);

  const handleUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserClose = () => {
    setAnchorEl(null);
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  async function handleSignOut() {
    if (signOutPending) return;
    setSignOutPending(true);
    setSignOutError(null);
    const result = await sqlBrowserLifecycle.signOut();
    if (!result.ok) {
      setSignOutError(
        result.code === "LOCAL_CLEANUP_FAILED"
          ? "Saved account data could not be locked. Retry sign-out."
          : "The server could not sign out this session. Retry sign-out.",
      );
      setSignOutPending(false);
    }
  }

  function share() {
    const data = {
      title: title + " - magick.ly",
      text:
        'Check out "' + title + '" on magick.ly, the open source magick app!',
      url: window.location.href,
    };

    //console.log({ data });

    if (navigator.share)
      navigator
        .share(data)
        .catch((error) => alert("Error sharing. " + JSON.stringify(error)));
    else alert("Sharing not supported on this platform.");
  }

  return (
    <div>
      <HideOnScroll>
        <AppBar>
          <Toolbar disableGutters={true} sx={{ px: 2 }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 0.5 }}
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
            {trail.length ? <InlineTrail trail={trail} /> : null}
            <Typography
              variant="h6"
              // The bar's title is the page heading wherever it names the
              // page, and holds nothing else: the menu sits outside it.
              component={known ? "h1" : "div"}
              sx={{
                // A long title is set smaller on a phone: at 360 px,
                // "Enochian Dictionary" and the menu's arrow take 175 px of
                // the 176 free at 17 px, beside the search button.
                ...(label.length > LONG_TITLE && {
                  fontSize: { xs: "1.0625rem", sm: "1.25rem" },
                }),
                flexGrow: 1,
                display: "inline-block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                height: "1.5em",
                whiteSpace: "nowrap",
              }}
            >
              {hasMenu ? (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-controls="nav-menu"
                  aria-expanded={Boolean(navAnchorEl)}
                  style={{
                    display: "block",
                    cursor: "pointer",
                    // A plain button, styled as the heading's text.
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onClick={(e) => setNavAnchorEl(e.currentTarget)}
                >
                  <span style={{ verticalAlign: "top" }}>{label}</span>
                  {navAnchorEl ? (
                    <ArrowDropUp
                      sx={{ verticalAlign: "bottom", marginBottom: 0.5 }}
                    />
                  ) : (
                    <ArrowDropDown
                      sx={{ verticalAlign: "bottom", marginBottom: 0.5 }}
                    />
                  )}
                </button>
              ) : (
                label
              )}
            </Typography>
            <div
              // Container for search, share and user buttons.
              style={{
                display: "inline-block",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <SearchButton />
              <IconButton color="inherit" aria-label="share" onClick={share}>
                <Share />
              </IconButton>
              {userId ? (
                <span>
                  <IconButton
                    aria-label="account of current user"
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleUserMenu}
                    color="inherit"
                  >
                    <UserAvatar />
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                      vertical: "top",
                      horizontal: "right",
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: "top",
                      horizontal: "right",
                    }}
                    open={Boolean(anchorEl)}
                    onClose={handleUserClose}
                  >
                    <MenuItem disabled={signOutPending} onClick={handleSignOut}>
                      {signOutPending ? "Signing out…" : "Logout"}
                    </MenuItem>
                    {signOutError && (
                      <Typography
                        color="error"
                        role="alert"
                        sx={{ maxWidth: 260, px: 2, py: 1 }}
                        variant="body2"
                      >
                        {signOutError}
                      </Typography>
                    )}
                  </Menu>
                </span>
              ) : (
                <React.Suspense
                  fallback={<SignInButton callbackURL={pathname} disabled />}
                >
                  <SignInWithQuery
                    pathname={pathname}
                    disabled={session.isPending || recovery.state !== "ready"}
                  />
                </React.Suspense>
              )}
            </div>
          </Toolbar>
        </AppBar>
      </HideOnScroll>
      {hasMenu ? (
        <NavMenu
          anchorEl={navAnchorEl}
          onClose={() => setNavAnchorEl(null)}
          ancestors={ancestors}
          current={known ? { title, url: titleUrl } : null}
          sectionPages={sectionPages}
          nested={known && childPages}
        />
      ) : null}
      <nav>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: 250,
            },
          }}
        >
          <MenuDrawer handleDrawerToggle={handleDrawerToggle} />
        </Drawer>
      </nav>
    </div>
  );
}
