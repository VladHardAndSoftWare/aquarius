import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites serve from /<repo>/, so the production base
// must match the repository name. Dev keeps "/" for a clean localhost URL.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/aquarius/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
}));
