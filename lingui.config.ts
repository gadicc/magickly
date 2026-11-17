import { formatter } from "@lingui/format-po";

/** @type {import("@lingui/conf").LinguiConfig} */
export default {
  locales: ["en", "he"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["<rootDir>/src/**/*.{ts,tsx}"],
    },
  ],
  format: formatter({ lineNumbers: false }),
};
