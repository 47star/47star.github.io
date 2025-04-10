import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import { SITE_DOMAIN } from "./src/consts";

export default defineConfig({
  site: `https://${SITE_DOMAIN}`,

  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    assets: "_nano",
  },
});
