import { Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadPublicRitual } from "@/doc/publicReader";
import { parseRitualRouteIdentity } from "@/doc/ritualRouteIdentity";
import { socialCardImage } from "@/seo/cards";
import { privateMetadata, seoMetadata } from "@/seo/metadata";
import DocRender from "../../../doc/[_id]/DocRender";
import PrivateRitualReader from "../../../doc/[_id]/PrivateRitualReader";
import ReaderShell from "../../../doc/ReaderShell";

/** Only anonymous, SQL-public rituals are indexed, under their canonical id. */
export async function generateMetadata({
  params,
}: PageProps<"/doc/[_id]">): Promise<Metadata> {
  await connection();
  const { publicRitual, publicDoc } = await loadPublicRitual(
    (await params)._id,
  );
  if (!publicRitual || !publicDoc) return privateMetadata("Ritual");
  const { id, title } = publicRitual.ritual;
  return seoMetadata(`/doc/${id}`, {
    title,
    description: `${title}: a public ritual on Magick.ly, laid out for reading on phones and tablets.`,
    // Stored rituals have no card of their own; the rituals list's fits.
    image: { ...socialCardImage("/gd/rituals", title), alt: title },
  });
}

/** SQL-public content may render anonymously; every other route gets the Dexie shell. */
export default async function DocPage({ params }: PageProps<"/doc/[_id]">) {
  await connection();
  const routeId = (await params)._id;
  const routeIdentity = parseRitualRouteIdentity(routeId);
  const { ritualId, publicRitual, publicDoc, deletedPublic } =
    await loadPublicRitual(routeId);
  // A deleted ritual that was public is gone for everyone: a real 404 until
  // it is purged, decided before anything streams. Any other deleted ritual
  // renders the private shell, exactly like an unknown ID.
  if (deletedPublic) notFound();
  if (publicRitual && publicDoc)
    return (
      <ReaderShell
        title={
          // A stored ritual's title is ritual text, not interface copy.
          <Typography
            variant="h4"
            component="h1"
            sx={{ mb: 2 }}
            lang=""
            dir="auto"
          >
            {publicRitual.ritual.title}
          </Typography>
        }
      >
        <Suspense fallback={<div>Loading ritual...</div>}>
          <DocRender doc={publicDoc} />
        </Suspense>
      </ReaderShell>
    );
  return (
    <Suspense fallback={<div>Loading ritual...</div>}>
      <PrivateRitualReader
        resolvedRitualId={ritualId}
        routeAlias={
          routeIdentity?.kind === "legacy-objectid"
            ? routeIdentity.legacyId
            : null
        }
      />
    </Suspense>
  );
}
