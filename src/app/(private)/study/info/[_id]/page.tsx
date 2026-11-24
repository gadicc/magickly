import { notFound } from "next/navigation";
import { privateUiMetadata } from "@/i18n/server";
import { isStudySetId } from "@/study/setIds";
import StudyInfo from "../../../../study/info/[_id]/info";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Flashcard Progress");
}

export default async function StudyInfoPage({
  params,
}: PageProps<"/study/info/[_id]">) {
  const { _id } = await params;
  if (!isStudySetId(_id)) notFound();
  return <StudyInfo _id={_id} />;
}
