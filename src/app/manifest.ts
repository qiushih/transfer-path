import type { MetadataRoute } from "next";

/**
 * Web app manifest, served by Next at /manifest.webmanifest.
 *
 * `display: standalone` matters more here than it usually does: the whole
 * point of installing this is to have the planner available without a
 * connection, and a standalone window makes it behave like something you
 * opened rather than a tab you happened to leave open.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UWaterloo Transfer & Major Planner",
    short_name: "UW Planner",
    description:
      "Check what you still need to transfer into a University of Waterloo faculty or declare a major. Works offline; your transcript never leaves your device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // A maskable icon keeps the checkmark inside the safe zone so Android
      // does not crop it when it applies its own mask shape.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
