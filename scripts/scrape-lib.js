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

export function pageImageUrl(img) {
  // Lazy-load plugins keep the real URL in data-lazy-src/data-src and leave an
  // inline SVG placeholder in src; prefer the data-* attrs and reject data: URIs.
  const url =
    img.getAttribute("data-lazy-src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("src");
  if (!url || url.startsWith("data:")) return null;
  return url;
}

export function parseStoryPages(html) {
  const root = parse(html);
  const scope = root.querySelector(".entry-content") || root;
  return scope
    .querySelectorAll("img")
    .map(pageImageUrl)
    .filter((u) => u && /\.(jpg|jpeg|png)/i.test(u) && !/-150x150|logo|avatar|gravatar|readmio-|banner/i.test(u));
}

export function catalogId(title) {
  return normalizeTitle(title).replace(/\s+/g, "-");
}

// Merge several sources into one deduped catalog keyed by normalized title.
// Each source item is { card: {title, url, cover}, media: {video?, audio?, read?} }.
// Later media values fill only empty slots are additive; the first non-empty cover wins.
export function mergeSources(sources) {
  const map = new Map();
  for (const { card, media } of sources) {
    const key = normalizeTitle(card?.title);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        id: catalogId(card.title),
        title: card.title,
        ageRange: "4-6",
        cover: card.cover || null,
        media: { video: null, audio: null, read: null, pages: [] },
      });
    }
    const rec = map.get(key);
    if (!rec.cover && card.cover) rec.cover = card.cover;
    for (const [k, v] of Object.entries(media || {})) {
      if (v && !rec.media[k]) rec.media[k] = v;
    }
  }
  return [...map.values()];
}
