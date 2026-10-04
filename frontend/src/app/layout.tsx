import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SessionBootstrap } from "@/components/providers/SessionBootstrap";
import { StoreProvider } from "@/components/providers/StoreProvider";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "HealthOS — Your health, organized in one place", template: "%s · HealthOS" },
  description:
    "HealthOS keeps your family's medical records, medications, appointments and lab reports organized, private and shareable on your terms.",
};

export const viewport: Viewport = { themeColor: "#0f6b66", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-[60] rounded bg-white px-3 py-2 text-sm shadow"
        >
          Skip to main content
        </a>
        <StoreProvider>
          <SessionBootstrap />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
