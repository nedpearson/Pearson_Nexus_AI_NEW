import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
  },
  // Windows + sandbox safety (prevents Vite prebundle edge cases)
  optimizeDeps: { noDiscovery: true, include: [] },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
});
