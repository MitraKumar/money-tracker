"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    // Leave new workers waiting until existing tabs close. Never force a reload
    // while a draft or a write with an unknown outcome may exist in tab memory.
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => { /* Installation failure must not block the online app. */ });
  }, []);

  return null;
}
