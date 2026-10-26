import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A fingerprint of a folder under public/: the village painter's kit
// (public/kit, see src/village/paint.js) and the village's pictures
// (public/village, see src/village/pictures.js). The app asks for
// /kit/<file>?v=<this> and /village/<picture>?v=<this>, so a phone holding
// the old kit or an old picture in its cache fetches the new one after a
// deploy.
function fingerprint(folder) {
  const hash = createHash("sha256");
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) walk(path);
      else hash.update(name).update(readFileSync(path));
    }
  };
  try {
    walk(fileURLToPath(new URL(folder, import.meta.url)));
  } catch {
    return "dev";
  }
  return hash.digest("hex").slice(0, 12);
}

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
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        // The village painter's kit (about 1.5 MB of scripts) and the village
        // pictures are fetched only when the village is shown, and kept once
        // fetched, instead of all of it downloading with every deploy. The
        // kit's addresses carry its fingerprint, so it is kept for good; so
        // do the pictures' (a repainted one comes under a new address), and
        // the kept one shows at once while it is checked behind it.
        globIgnores: ["**/kit/**", "**/village/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/kit/"),
            handler: "CacheFirst",
            options: { cacheName: "village-kit", expiration: { maxEntries: 80 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/village/") && /\.(jpe?g|png|webp)$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "village-pictures", expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
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
  define: {
    __KIT_VERSION__: JSON.stringify(fingerprint("./public/kit")),
    __PIC_VERSION__: JSON.stringify(fingerprint("./public/village")),
  },
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
