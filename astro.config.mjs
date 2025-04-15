import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import UnoCSS from "unocss/astro";
import transformerCompileClass from "@unocss/transformer-compile-class";
import { SITE_DOMAIN } from "./src/consts";

export default defineConfig({
  site: `https://${SITE_DOMAIN}`,

  integrations: [
    mdx(),
    sitemap(),
    UnoCSS({
      transformers: [
        transformerCompileClass({
          classPrefix: "rvl-",
        }),
      ],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    assets: "_nano",
  },
});
