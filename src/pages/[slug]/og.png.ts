import fs from "node:fs";
import { createRequire } from "node:module";
import { type CollectionEntry, getCollection } from "astro:content";
import { ImageResponse } from "@vercel/og";
import { SITE_DOMAIN, SITE_TITLE } from "../../consts";

type Fonts = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>["fonts"];

const require = createRequire(import.meta.url);

const pretendard: Fonts = ["Regular", "Medium", "SemiBold", "Bold"].map(
  (weight) => ({
    name: `Pretendard ${weight}`,
    data: fs.readFileSync(
      require.resolve(`pretendard/dist/public/static/Pretendard-${weight}.otf`),
    ),
    style: "normal",
  }),
);

const fonts: Fonts = [
  ...pretendard,
  {
    name: "Noto Color Emoji",
    data: fs.readFileSync(
      require.resolve(
        "@fontsource/noto-emoji/files/noto-emoji-emoji-400-normal.woff",
      ),
    ),
    style: "normal",
  },
];

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}

export async function GET({
  props,
}: {
  props: CollectionEntry<"blog">;
}) {
  const html = {
    type: "div",
    props: {
      children: [
        {
          type: "div",
          props: {
            tw: "absolute -bottom-32 -right-32 text-[36rem] text-blue-700/10",
            style: {
              fontFamily: "Noto Color Emoji",
            },
            children: props.data.icon,
          },
        },
        {
          type: "div",
          props: {
            tw: "text-6xl leading-1.2 mt-10",
            style: {
              fontFamily: "Pretendard SemiBold",
              wordBreak: "keep-all",
            },
            children: props.data.title,
          },
        },
        {
          type: "div",
          props: {
            tw: "flex flex-row text-3xl mt-10",
            children: [
              {
                type: "div",
                props: {
                  tw: "mr-4",
                  style: {
                    fontFamily: "Pretendard Medium",
                  },
                  children: SITE_TITLE,
                },
              },
              {
                type: "div",
                props: {
                  tw: "mr-4",
                  style: {
                    fontFamily: "Pretendard Regular",
                  },
                  children: "|",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Pretendard Regular",
                  },
                  children: SITE_DOMAIN,
                },
              },
            ],
          },
        },
      ],
      tw: "relative w-full h-full flex flex-col justify-center px-24 py-12 bg-white",
    },
  };

  return new ImageResponse(html, {
    width: 1200,
    height: 600,
    fonts,
  });
}
