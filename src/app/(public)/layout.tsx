import type { ReactNode } from "react";
import Document from "@/app/Document";

export { metadata, viewport } from "@/app/Document";

export default function Layout({ children }: { children: ReactNode }) {
  return <Document>{children}</Document>;
}
