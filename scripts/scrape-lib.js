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

// Storyberries' ?s= search results put the title in an <h2 class="entry-title">
// (plain text, no inner link) and the story link on the thumbnail, so
// parseListing misses them. This parser reads title + cover for cover lookups.
export function parseStoryberriesSearch(html) {
  const root = parse(html);
  return root
    .querySelectorAll("article")
    .map((card) => {
      const title = card.querySelector(".entry-title")?.text.trim();
      const link = card.querySelector(".entry-title a") || card.querySelector("a[href]");
      const img = card.querySelector("img.wp-post-image, img");
      const cover =
        img?.getAttribute("data-lazy-src") ||
        img?.getAttribute("data-src") ||
        img?.getAttribute("src");
      return { title, url: link?.getAttribute("href"), cover };
    })
    .filter((c) => c.title && c.cover && !String(c.cover).startsWith("data:"));
}

// Best Storyberries cover for a title from a set of search-result cards:
// exact normalized-title match wins, else a strong title-coverage match.
export function matchCover(title, cards) {
  const norm = normalizeTitle(title);
  const exact = (cards || []).find((c) => normalizeTitle(c.title) === norm);
  if (exact) return exact.cover;
  const best = (cards || [])
    .map((c) => ({ c, score: titleCoverage(title, c.title) }))
    .filter((x) => x.score >= 0.85)
    .sort((a, b) => b.score - a.score)[0];
  return best ? best.c.cover : null;
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
        ageRange: card.ageRange || "4-6",
        source: card.source || "storyberries",
        level: card.level || null,
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

// ---- StoryWeaver (Pratham Books) open library --------------------------------
// The books-search API returns openly-licensed (CC-BY) picture books with a
// reading level. Level 1–2 English books fit ages 4–6. StoryWeaver's reader is
// form-gated, so these are "library" cards that open the book on StoryWeaver —
// consistent with the app's stream-don't-rehost rule.
export function pickCover(coverImage) {
  const sizes = coverImage?.sizes;
  if (!Array.isArray(sizes) || !sizes.length) return null;
  // Prefer a mid/large crop (index 2–3) for a crisp cover, fall back to biggest.
  const byWidth = [...sizes].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (byWidth[2] || byWidth[byWidth.length - 1]).url || null;
}

export function parseStoryWeaver(json) {
  const rows = json?.data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((b) => ({
      title: (b.title || "").trim(),
      // Link straight into the reader (?mode=read) so a tap opens the book, not
      // the story's landing page.
      url: b.slug ? `https://storyweaver.org.in/en/stories/${b.slug}?mode=read` : null,
      cover: pickCover(b.coverImage),
      level: b.level != null ? String(b.level) : null,
      source: "storyweaver",
    }))
    .filter((c) => c.title && c.url && c.cover);
}

// ---- Safe YouTube video matching --------------------------------------------
// Extract (videoId, title, channelId) triples from a YouTube results page's
// embedded ytInitialData. We never trust an arbitrary search hit — bestVideoMatch
// keeps a result only when it comes from a vetted channel AND its title actually
// covers the story title. This is what makes auto-linking safe for a 4–6 app.
// Walk any YouTube response object (search HTML data OR innertube JSON) and pull
// every videoRenderer plus the next continuation token (for paging a channel).
export function extractSearchPage(data) {
  const videos = [];
  let continuation = null;
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.videoRenderer && o.videoRenderer.videoId) {
      const v = o.videoRenderer;
      const byline = JSON.stringify(v.ownerText || v.longBylineText || v.shortBylineText || "");
      const channelId = (byline.match(/UC[\w-]{22}/) || [])[0] || null;
      videos.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || v.title?.simpleText || "",
        channelId,
      });
    }
    if (o.continuationItemRenderer) {
      continuation =
        o.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || continuation;
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
  return { videos, continuation };
}

export function parseSearchResults(html) {
  const m = html.match(/ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
  if (!m) return [];
  try {
    return extractSearchPage(JSON.parse(m[1])).videos;
  } catch {
    return [];
  }
}

// YouTube video titles carry marketing cruft ("🍓 Read along animated picture
// book | Age 4-6 | #family"). cleanVideoTitle keeps just the story name.
export function cleanVideoTitle(raw) {
  let t = String(raw || "");
  const markers = [/🍓/u, /\|/, /[-–—]\s*Read[\s-]?along/i, /\bKids Read[\s-]?along/i, /\bRead[\s-]?along/i, /\bRead Aloud/i];
  let cut = t.length;
  for (const m of markers) {
    const idx = t.search(m);
    if (idx >= 0) cut = Math.min(cut, idx);
  }
  t = t.slice(0, cut);
  t = t.replace(/#[A-Za-z]\w*/g, " "); // drop word hashtags, keep "#1"
  t = t.replace(/[\u{1F000}-\u{1FAFF}☀-➿←-⇿]/gu, " "); // emoji/symbols
  t = t.replace(/\s+/g, " ").trim().replace(/^[|\-–—:,\s]+|[|\-–—:,\s]+$/g, "").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters && letters === letters.toUpperCase()) {
    t = t.toLowerCase().replace(/(^|\s)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  }
  return t;
}

export function parseAgeFromTitle(raw) {
  const t = String(raw || "");
  if (/age\s*7\s*-\s*12/i.test(t)) return "7-12";
  if (/age\s*4\s*-\s*6/i.test(t)) return "4-6";
  return null;
}

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const STOPWORDS = new Set(["the", "a", "an", "and", "of", "to", "for", "s"]);

// Fraction of the story's meaningful words that appear in the video title.
export function titleCoverage(storyTitle, videoTitle) {
  const words = (t) =>
    normalizeTitle(t)
      .split(" ")
      .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const want = words(storyTitle);
  if (!want.length) return 0;
  const have = new Set(words(videoTitle));
  const hit = want.filter((w) => have.has(w)).length;
  return hit / want.length;
}

// Pick the strongest video from a vetted channel that clearly matches the story.
// vetted is a Set/object of allowed channel IDs. Returns a videoId or null.
export function bestVideoMatch(storyTitle, results, vetted, minCoverage = 0.8) {
  const allowed = (id) => (vetted instanceof Set ? vetted.has(id) : Boolean(vetted?.[id]));
  const scored = (results || [])
    .filter((r) => r.id && allowed(r.channelId))
    .map((r) => ({ ...r, score: titleCoverage(storyTitle, r.title) }))
    .filter((r) => r.score >= minCoverage)
    .sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].id : null;
}
