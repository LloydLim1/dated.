import type { Metadata } from "next";
import DatedLanding from "@/components/dated-landing";

export const metadata: Metadata = {
  title: "Dated — Find your kind of place",
  description:
    "Discover local places around Metro Manila, keep your visits in a photo journal, and earn rewards for eligible reviews. Free for customers, with paid tools for local businesses.",
};

export default function Page() {
  return <DatedLanding />;
}
