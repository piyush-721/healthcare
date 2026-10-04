import type { Metadata } from "next";

import { RecordDetailPage } from "@/features/records/RecordDetailPage";

export const metadata: Metadata = { title: "Medical record" };

export default function Page() {
  return <RecordDetailPage />;
}
