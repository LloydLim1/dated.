import DatedApp from "@/components/dated-app";
import { notFound, redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (view === "premium") redirect("/planning");
  if (
    ![
      "explore",
      "map",
      "saved",
      "outings",
      "profile",
      "community",
      "planning",
      "wallet",
      "business",
      "operations",
    ].includes(view)
  )
    notFound();
  return <DatedApp initialView={view} />;
}
