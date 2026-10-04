import type { Metadata } from "next";

import { SharedViewPage } from "@/features/sharing/SharedViewPage";

export const metadata: Metadata = {
  title: "Shared health information",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <SharedViewPage />;
}
