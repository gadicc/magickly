import localFont from "next/font/local";

// The Enochian webfont for the app's pages (see enochian/ and
// assets/fonts/EnochianPlain-NOTICE.txt). It stays in the app: the font has
// no licence text, so it cannot ship in the MIT magick-components package,
// whose Tablet takes the style it should use as `enochianStyle` (plan 080,
// decision 7).
const enochianFont = localFont({
  src: [
    {
      path: "./enochian/enochian-webfont.woff",
    },
    {
      path: "./enochian/enochian-webfont.woff2",
    },
  ],
  // display: "swap",
});

const _enochianFont = {
  ...enochianFont,
  style: {
    ...enochianFont.style,
    fontFamily:
      enochianFont.style.fontFamily + ", 'Enochian Plain', 'Enochian'",
    direction: "rtl" as const,
    unicodeBidi: "bidi-override" as const,
  },
};

export default _enochianFont;
