import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the repo name for GitHub Pages project sites:
// https://musicofthings.github.io/studioplan/
export default defineConfig({
  base: "/studioplan/",
  plugins: [react()],
});
