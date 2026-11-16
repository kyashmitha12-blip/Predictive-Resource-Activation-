/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// In development the browser talks to Vite, and Vite forwards /api to the FastAPI server.
// In production the host forwards /api (see vercel.json), so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173, proxy: { "/api": { target: process.env.VITE_DEV_API ?? "http://localhost:8000", changeOrigin: false } } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"], css: false },
});
