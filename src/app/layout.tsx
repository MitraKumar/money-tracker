import type { Metadata, Viewport } from "next";
import { AppTheme } from "@/components/app-theme";
import { TrackerProvider } from "@/components/tracker-provider";
import { TrackerShell } from "@/components/tracker-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Tracker",
  description: "Track your money, one message at a time.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-astryx-theme="matcha">
      <body>
        <AppTheme><TrackerProvider><TrackerShell>{children}</TrackerShell></TrackerProvider></AppTheme>
      </body>
    </html>
  );
}
