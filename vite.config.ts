import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },

  // Vite 7+ way to effectively disable deps optimizer discovery/prebundle
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },

  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    hmr: { host: "127.0.0.1", port: 5174 },

    // Windows/AV/CFA-friendly watcher mode
    watch: { usePolling: true, interval: 150 },
  },

  clearScreen: false,
});
