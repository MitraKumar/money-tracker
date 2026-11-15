"use client";

import { Theme } from "@astryxdesign/core/theme";
import { createContext, useContext, useSyncExternalStore } from "react";
import { defaultThemeSlug, themes } from "../astryx-themes";

type Appearance = "light" | "dark" | "system";
const storageKey = "money-tracker-appearance";
const changeEvent = "money-tracker-appearance-change";
let fallback: Appearance = "system";

function readAppearance(): Appearance {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return fallback;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function setAppearance(value: Appearance) {
  fallback = value;
  try { localStorage.setItem(storageKey, value); } catch { /* Keep the choice for this session. */ }
  window.dispatchEvent(new Event(changeEvent));
}

const AppearanceContext = createContext({ appearance: "system" as Appearance, setAppearance });
export const useAppearance = () => useContext(AppearanceContext);

export function AppTheme({ children }: { children: React.ReactNode }) {
  const appearance = useSyncExternalStore(subscribe, readAppearance, () => "system" as Appearance);
  return <AppearanceContext value={{ appearance, setAppearance }}>
    <Theme theme={themes[defaultThemeSlug]} mode={appearance}>{children}</Theme>
  </AppearanceContext>;
}
