import { expect, it } from "vitest";
import { isResearchPath } from "./paths";

it.each([
  "/chat/research",
  "/chat/research/",
  "/chat/research/api",
  "/chat/%72esearch/api",
  "/%63hat/research",
  "/chat%2Fresearch",
  "/CHAT/RESEARCH",
  "/chat//research",
  "//chat/research",
  "/chat/%5Cresearch",
  "/chat/research/%ZZ",
  "/chat/%72esearch/%",
  "/chat%2fresearch/%ZZ",
  "/chat/research%2f%ZZ",
  "/chat/research/%E0%80",
])("classifies private variants %s", (path) =>
  expect(isResearchPath(path)).toBe(true),
);
it.each([
  "/chat",
  "/chat/api",
  "/chat/researching",
  "/other/chat/research",
  "/%",
])("retains other route classification %s", (path) =>
  expect(isResearchPath(path)).toBe(false),
);
