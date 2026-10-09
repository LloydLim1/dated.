import DatedApp from "@/components/dated-app";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (
    !["explore", "map", "saved", "outings", "profile", "community", "premium"].includes(
      view,
    )
  )
    notFound();
  return <DatedApp initialView={view} />;
}
