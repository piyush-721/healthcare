import type { Metadata } from "next";

import { NotificationPreferencesPage } from "@/features/notifications/NotificationPreferencesPage";

export const metadata: Metadata = { title: "Notification preferences" };

export default function Page() {
  return <NotificationPreferencesPage />;
}
