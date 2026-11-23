import {
  type AnyComponentImageLink,
  componentImagePath,
} from "@/render/componentImageUrl";
import { copyPng, copySvg, downloadBlob } from "./exportRuntime";
import type { FileIconType } from "./FileIcon";

/** What a format's actions export: the live drawing, read at the click. */
export interface ExportSource {
  /** File name without extension. */
  filename: string;
  /** The SVG file's text, with the page's credit. */
  svgText(): string;
  /**
   * The PNG, with the page's credit. Its promise is returned at once, so a
   * clipboard write can take it inside the click (Safari).
   */
  png(): Promise<Blob>;
}

/** A Lingui message, marked where it is written; `{format}` is the name. */
export interface ExportMessage {
  id: string;
  comment?: string;
}

/**
 * One row of the export controls (plan 097, decisions 1 and 4). Each
 * action starts its browser side effect before its first `await`, so a
 * download or clipboard write keeps the click's user gesture.
 */
export interface ExportFormat {
  /** The extension, lower case: the file icon's and the download's. */
  type: FileIconType;
  /** The format's name, in Latin letters in every language. */
  name: string;
  /** Why a reader would choose it, under the name. */
  hint: ExportMessage;
  /** Starts the download. */
  save(source: ExportSource): Promise<void>;
  /** Copies to the clipboard; resolves to the confirmation. */
  copy(source: ExportSource): Promise<ExportMessage>;
  /** The site-relative image link, where the image route draws this format. */
  link?(link: AnyComponentImageLink): string;
}

export const SVG_FORMAT: ExportFormat = {
  type: "svg",
  name: "SVG",
  hint: /*i18n*/ {
    id: "Sharp at any size",
    comment:
      "Why to choose SVG, under its name in the export box below a drawing: a vector file stays sharp however large it is shown",
  },
  async save(source) {
    downloadBlob(
      new Blob([source.svgText()], { type: "image/svg+xml" }),
      `${source.filename}.svg`,
    );
  },
  async copy(source) {
    return (await copySvg(source.svgText())) === "image/svg+xml"
      ? /*i18n*/ {
          id: "Copied {format} image to clipboard",
          comment:
            "Confirms a drawing copied as an image. {format} is the file format, such as SVG, in Latin letters",
        }
      : /*i18n*/ {
          id: "Copied {format} text to clipboard",
          comment:
            "Confirms a drawing copied as SVG source text, where the browser cannot copy it as an image. {format} is the file format, SVG, in Latin letters",
        };
  },
  link: (link) => componentImagePath(link),
};

export const PNG_FORMAT: ExportFormat = {
  type: "png",
  name: "PNG",
  hint: /*i18n*/ {
    id: "Pastes anywhere",
    comment:
      "Why to choose PNG, under its name in the export box below a drawing: a picture that any app accepts when pasted",
  },
  async save(source) {
    downloadBlob(await source.png(), `${source.filename}.png`);
  },
  async copy(source) {
    await copyPng(source.png());
    return /*i18n*/ {
      id: "Copied {format} to clipboard",
      comment:
        "Confirms a drawing copied as a picture. {format} is the file format, such as PNG, in Latin letters",
    };
  },
  link: (link) => componentImagePath(link, { format: "png" }),
};

/** The formats every drawing offers, one row each, in this order. */
export const EXPORT_FORMATS: readonly ExportFormat[] = [SVG_FORMAT, PNG_FORMAT];
