/**
 * Offline-first service worker for the UWaterloo Transfer & Major Planner.
 *
 * The app is a good fit for this: it makes no runtime network calls, the whole
 * course catalog is bundled into the JavaScript, and the profile lives in
 * localStorage. Once the code is on the device, every eligibility check,
 * transcript parse and course plan is pure local computation. The only thing
 * standing between the app and full offline use was the page load itself.
 *
 * WHY NOT A PRECACHE LIST: Next content-hashes every asset, so the filenames
 * change on each build and cannot be hardcoded here. Instead this caches
 * same-origin assets as they are fetched. That is safe precisely because the
 * names are content-hashed - a cached `/_next/static/...` file can never be
 * stale, since any change produces a different URL.
 *
 * The one thing that needs deliberate warming is the pdf.js chunk: it is
 * dynamically imported and would otherwise never be cached for a student who
 * has not opened a PDF while online. The page requests it on idle; see
 * `OfflineReady.tsx`.
 */

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

/** The document itself, so a cold offline start has something to render. */
const SHELL_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // `reload` bypasses the HTTP cache so the install captures the shell as
      // the server currently serves it, not a stale copy.
      await cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: "reload" })));
      // Take over as soon as the new worker is ready; the app is a single page
      // with no long-lived state outside localStorage, so there is nothing for
      // an abrupt swap to corrupt.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS]);
      await Promise.all(
        (await caches.keys()).filter((key) => !keep.has(key)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Content-hashed build output: safe to serve from cache indefinitely. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Icons and other files we ship from /public. */
function isStaticFile(url) {
  return /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Anything cross-origin - the Schedule of Classes links, most importantly -
  // is left entirely alone. Caching a live timetable would be worse than
  // useless: a student would be shown seat counts that are quietly out of date.
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so a deployed update is picked up, and fall
  // back to the cached shell when there is no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL);
          cache.put("/", fresh.clone());
          return fresh;
        } catch {
          return (await caches.match("/", { cacheName: SHELL })) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (isImmutableAsset(url) || isStaticFile(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const fresh = await fetch(request);
          // Opaque responses carry no status, and caching an error would pin
          // the failure until the next version bump.
          if (fresh.ok) {
            const cache = await caches.open(ASSETS);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (error) {
          // Nothing cached and no network: let the request fail honestly
          // rather than returning an empty 200 the app would misread.
          throw error;
        }
      })(),
    );
  }
});
