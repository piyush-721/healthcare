import type { Metadata } from "next";

import { HealthProfilePage } from "@/features/health-profile/HealthProfilePage";

export const metadata: Metadata = { title: "Health profile" };

export default function Page() {
  return <HealthProfilePage />;
}
