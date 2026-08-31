"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker and makes the app genuinely usable offline.
 *
 * Two jobs, and the second is the one that is easy to miss:
 *
 * 1. Register `/sw.js`, which caches the shell and the content-hashed build
 *    output as it is fetched.
 *
 * 2. **Warm the pdf.js chunk.** PDF parsing is a dynamic import, so its ~0.43MB
 *    chunk is only downloaded the first time someone opens a PDF. A student who
 *    loads the app online, goes offline, and *then* tries to import their
 *    transcript would hit a module that was never cached. Requesting it once on
 *    idle closes that gap, which is the difference between "works offline" and
 *    "works offline unless you actually use it".
 */

function useOnline(): boolean {
  // Assume online for the first render so the server-rendered markup and the
  // first client render agree; the effect corrects it immediately.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export function OfflineReady() {
  const online = useOnline();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Registering after load keeps the worker off the critical path of the
    // first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // A failed registration must not break the app; it only costs offline
        // support, and the page works exactly as it did before.
        console.warn("Service worker registration failed:", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    // Only worth fetching while there is a connection to fetch it over.
    if (!online) return;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      // Importing the wrapper alone is not enough - pdf.js sits behind a second
      // dynamic import inside it, and the worker is a third asset. warmPdfEngine
      // pulls all three through so the service worker can cache them.
      import("@/lib/pdf-text")
        .then((m) => m.warmPdfEngine())
        .catch(() => {
          // Offline or blocked: pasting transcript text still works.
        });
    };

    const idle = window.requestIdleCallback?.(warm, { timeout: 4000 }) ?? window.setTimeout(warm, 2000);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof idle === "number") window.cancelIdleCallback(idle);
    };
  }, [online]);

  if (online) return null;

  return (
    <p
      role="status"
      className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
    >
      <strong className="font-semibold">You are offline.</strong> Everything here still works -
      your profile, transcript import, and all requirement checks run on this device. Only the
      &ldquo;check sections&rdquo; links need a connection, since seat counts are live.
    </p>
  );
}
