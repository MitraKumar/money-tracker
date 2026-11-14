import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa-registration";
import { AppTheme } from "@/components/app-theme";
import { TrackerProvider } from "@/components/tracker-provider";
import { TrackerShell } from "@/components/tracker-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Tracker",
  applicationName: "Money Tracker",
  appleWebApp: { capable: true, title: "Money Tracker", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/icons/apple-touch-icon.png" },
  description: "Track your money, one message at a time.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f0f0e0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-astryx-theme="matcha">
      <body>
        <PwaRegistration />
        <AppTheme><TrackerProvider><TrackerShell>{children}</TrackerShell></TrackerProvider></AppTheme>
      </body>
    </html>
  );
}
