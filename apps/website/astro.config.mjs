import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

const proxy = {
  "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
};

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: { proxy },
    preview: { proxy },
  },
});
