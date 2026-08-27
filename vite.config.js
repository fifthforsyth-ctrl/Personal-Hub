import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA setup is what makes "Add to Home Screen" on iPhone/iPad behave like a
// real app (own icon, no browser chrome, launches to last route) instead of
// just a bookmark. autoUpdate means a redeploy is picked up on next launch
// without the user having to reinstall anything.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Personal Hub",
        short_name: "Personal Hub",
        description: "Life archival, tracking, and personal vision centered on Christlike discipleship.",
        theme_color: "#0b0a12",
        background_color: "#0b0a12",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
  },
});
