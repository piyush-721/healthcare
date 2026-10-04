import type { Metadata } from "next";

import { Reactivate } from "@/features/auth/Reactivate";

export const metadata: Metadata = { title: "Reactivate account" };

export default function ReactivatePage() {
  return <Reactivate />;
}
