import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        // The three.js scene is lazy-loaded in its own chunk.
        chunkSizeWarningLimit: 1200,
    },
});
