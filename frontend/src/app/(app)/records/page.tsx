import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui";
import { RecordsPage } from "@/features/records/RecordsPage";

export const metadata: Metadata = { title: "Medical records" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecordsPage />
    </Suspense>
  );
}
