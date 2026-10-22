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
      // Without these the new service worker installs but waits for every
      // tab to close before taking over, so a redeploy can sit behind a
      // stale bundle for days on a home-screen app that is never really
      // closed. Claim the page and activate immediately instead.
      workbox: { clientsClaim: true, skipWaiting: true },
      includeAssets: ["apple-touch-icon.png", "favicon.png"],
      manifest: {
        name: "Personal Hub",
        short_name: "Personal Hub",
        description: "Wins, minutes and your walk with God, day by day.",
        theme_color: "#f2f1ee",
        background_color: "#f2f1ee",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // Libraries change far less often than the app, so keeping them in their
  // own files means a redeploy only re-downloads the app's code.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          // Only the village uses it, so it loads the first time you open the village.
          three: ["three"],
        },
      },
    },
    // three.js is about 600 kB on its own and can't be split further.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
  },
});
