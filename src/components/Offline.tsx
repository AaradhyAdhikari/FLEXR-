"use client";

import { useEffect, useState } from "react";

/** Registers the service worker once, so Flexr opens without a signal. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Wait for idle so it never competes with the first paint.
    const id = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a bonus, not a requirement */
      });
    }, 1200);
    return () => clearTimeout(id);
  }, []);
  return null;
}

/** Is the browser online right now? */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

/** Small marker in the header while there's no connection. */
export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
      role="status"
      data-testid="offline-badge"
    >
      Offline · kept on this phone
    </span>
  );
}
