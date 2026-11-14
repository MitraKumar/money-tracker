"use client";

import { Theme } from "@astryxdesign/core/theme";
import { defaultThemeSlug, themes } from "../astryx-themes";

export function AppTheme({ children }: { children: React.ReactNode }) {
  return <Theme theme={themes[defaultThemeSlug]} mode="light">{children}</Theme>;
}
