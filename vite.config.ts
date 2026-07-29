import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// The static assets folder in this repo is capitalized "Public".
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "RBC Line Performance",
        short_name: "RBC Perf",
        description: "Sewing floor performance tracking app",
        start_url: "/",
        display: "standalone",
        background_color: "#F6F4FC",
        theme_color: "#7E6FB1",
        orientation: "portrait",
        icons: [
          { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "supabase-api", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  publicDir: "Public",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
