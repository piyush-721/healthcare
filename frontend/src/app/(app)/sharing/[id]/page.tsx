import type { Metadata } from "next";

import { ShareDetailPage } from "@/features/sharing/ShareDetailPage";

export const metadata: Metadata = { title: "Share details" };

export default function Page() {
  return <ShareDetailPage />;
}
