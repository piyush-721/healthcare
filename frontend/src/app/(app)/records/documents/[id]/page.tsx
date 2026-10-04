import type { Metadata } from "next";

import { DocumentDetailPage } from "@/features/records/DocumentDetailPage";

export const metadata: Metadata = { title: "Document" };

export default function Page() {
  return <DocumentDetailPage />;
}
