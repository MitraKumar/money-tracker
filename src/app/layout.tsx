import type { Metadata } from "next";
import { AppTheme } from "@/components/app-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Tracker",
  description: "Track your money, one message at a time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-astryx-theme="matcha">
      <body>
        <AppTheme>{children}</AppTheme>
      </body>
    </html>
  );
}
