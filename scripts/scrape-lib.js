import { parse } from "node-html-parser";

export function normalizeTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseListing(html) {
  const root = parse(html);
  return root
    .querySelectorAll("article")
    .map((card) => {
      const link = card.querySelector("h2.entry-title a, .entry-title a, h2 a");
      const img = card.querySelector("img.wp-post-image, img");
      const title = link?.text.trim();
      const url = link?.getAttribute("href");
      const cover =
        img?.getAttribute("data-src") ||
        img?.getAttribute("data-lazy-src") ||
        img?.getAttribute("src");
      return { title, url, cover };
    })
    .filter((c) => c.title && c.url && c.cover);
}

export function parseStoryPages(html) {
  const root = parse(html);
  const scope = root.querySelector(".entry-content") || root;
  return scope
    .querySelectorAll("img")
    .map((i) => i.getAttribute("data-src") || i.getAttribute("src"))
    .filter((u) => u && /\.(jpg|jpeg|png)/i.test(u));
}

export function matchMedia(stories, videoIndex, audioIndex) {
  return stories.map((s) => {
    const key = normalizeTitle(s.title);
    return {
      id: key.replace(/\s+/g, "-"),
      title: s.title,
      ageRange: "4-6",
      cover: s.cover,
      media: {
        video: videoIndex.get(key) || null,
        audio: audioIndex.get(key) || null,
        read: s.url || null,
        pages: [],
      },
    };
  });
}
