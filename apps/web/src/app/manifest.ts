import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poolr",
    short_name: "Poolr",
    description: "Rotating savings circles, reimagined for the modern age.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5fbf9",
    theme_color: "#0f6e56",
    categories: ["finance"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon-256.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My groups",
        short_name: "Groups",
        url: "/groups",
        icons: [{ src: "/favicon-256.png", sizes: "192x192" }],
      },
      {
        name: "Dashboard",
        short_name: "Home",
        url: "/dashboard",
        icons: [{ src: "/favicon-256.png", sizes: "192x192" }],
      },
    ],
  };
}
