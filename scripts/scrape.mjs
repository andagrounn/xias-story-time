import { writeFileSync } from "node:fs";
import {
  parseListing,
  parseStoryPages,
  normalizeTitle,
  matchCover,
  extractSearchPage,
  cleanVideoTitle,
  parseAgeFromTitle,
  ytThumb,
  mergeSources,
} from "./scrape-lib.js";

// Storyberries read-along categories to pull, each tagged with its age range.
const AGE_CATEGORIES = [
  { slug: "age-4-6-bedtime-stories", ageRange: "4-6", pages: 6 }, // ~54 for Xia
  { slug: "age-7-12-bedtime-stories", ageRange: "7-12", pages: 6 }, // older kids
];

// Storyberries' own YouTube channel — every upload is an animated storybook, so
// harvesting the whole channel gives us "all the books that have a video".
const STORYBERRIES_CHANNEL = "UCQoz7oLrUVZlC0hsXdyA7oA";
const HARVEST_QUERY = "storyberries read along animated picture book";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (personal reader)" } };

async function getHtml(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Collect story cards across N pages of a category.
async function collect(baseUrl, pages, label) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const url = p === 1 ? baseUrl : `${baseUrl}page/${p}/`;
    console.log(label, url);
    try {
      out.push(...parseListing(await getHtml(url)));
    } catch (e) {
      console.warn("  skip:", e.message);
    }
  }
  return out;
}

// ---- YouTube channel harvest -------------------------------------------------
// YouTube's channel "videos" tab is consent-walled, but the internal search API
// (with continuation paging) reliably enumerates a channel. We search the
// channel name and keep only videoRenderers whose owner IS the channel.
const YT_CTX = {
  context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en", gl: "US" } },
};
async function ytSearch(body) {
  const r = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { ...UA.headers, "Content-Type": "application/json", "Accept-Language": "en-US,en;q=0.9" },
    body: JSON.stringify({ ...YT_CTX, ...body }),
  });
  return r.json();
}

async function harvestChannelVideos(channelId, query, maxPages = 30) {
  const seen = new Set();
  const out = [];
  const take = (videos) => {
    for (const v of videos) {
      if (v.channelId !== channelId || !v.id || seen.has(v.id)) continue;
      seen.add(v.id);
      const title = cleanVideoTitle(v.title);
      if (title) out.push({ id: v.id, title, ageRange: parseAgeFromTitle(v.title) });
    }
  };
  let { videos, continuation } = extractSearchPage(await ytSearch({ query, params: "EgIQAQ%3D%3D" }));
  take(videos);
  let page = 1;
  while (continuation && page < maxPages) {
    const { videos: v2, continuation: c2 } = extractSearchPage(await ytSearch({ continuation }));
    if (!v2.length) break;
    take(v2);
    continuation = c2;
    page++;
    await sleep(80);
  }
  console.log(`harvested ${out.length} channel videos over ${page} pages`);
  return out;
}

// Build a title→cover index by crawling Storyberries' story-type category
// listings. Category pages are static and cache-friendly (unlike the ?s= search,
// which is server-expensive and rate-limits), so this is the respectful way to
// harvest real book covers in bulk. Highest-yield categories for video books:
const COVER_CATEGORIES = [
  ["picture-books", 60],
  ["5-min-stories-free-bedtime-stories-poems-fairy-tales", 45],
  ["10-min-stories-free-bedtime-stories-poems-fairy-tales", 30],
  ["poems-for-kids", 25],
  ["fairy-tales", 25],
];

async function buildCoverIndex() {
  const map = new Map(); // normalized title → { title, cover }
  for (const [cat, cap] of COVER_CATEGORIES) {
    let got = 0;
    for (let p = 1; p <= cap; p++) {
      const url = `https://www.storyberries.com/category/${cat}/${p === 1 ? "" : `page/${p}/`}`;
      let cards;
      try {
        const r = await fetch(url, UA);
        if (!r.ok) break;
        cards = parseListing(await r.text());
      } catch {
        break;
      }
      if (!cards.length) break;
      for (const c of cards) {
        const k = normalizeTitle(c.title);
        if (c.cover && !map.has(k)) map.set(k, { title: c.title, cover: c.cover });
      }
      got += cards.length;
      await sleep(40);
    }
    console.log(`  cover index: ${cat} (+${got}) → ${map.size} unique`);
  }
  return map;
}

// Replace YouTube-thumbnail covers with the matching Storyberries book cover.
// Exact title match first, then a strong fuzzy match; keep the thumbnail when
// nothing matches (e.g. multi-story "collection" videos with no book page).
function backfillCovers(stories, index) {
  const cards = [...index.values()];
  let swapped = 0;
  for (const s of stories) {
    if (!/i\.ytimg\.com/.test(s.cover || "")) continue;
    const cover = index.get(normalizeTitle(s.title))?.cover || matchCover(s.title, cards);
    if (cover) {
      s.cover = cover;
      swapped++;
    }
  }
  const total = stories.filter((s) => /i\.ytimg\.com/.test(s.cover || "")).length + swapped;
  console.log(`covers: swapped ${swapped} of ${total} youtube thumbnails for storyberries covers`);
}

// ---- Build -------------------------------------------------------------------

// Read-along picture books, tagged by age.
const readCards = [];
for (const cat of AGE_CATEGORIES) {
  const cards = await collect(
    `https://www.storyberries.com/category/${cat.slug}/`,
    cat.pages,
    `read ${cat.ageRange}`
  );
  for (const c of cards) c.ageRange = cat.ageRange;
  readCards.push(...cards);
}
const readSources = readCards.map((card) => ({ card, media: { read: card.url } }));

// Every animated video book on the channel.
const harvest = await harvestChannelVideos(STORYBERRIES_CHANNEL, HARVEST_QUERY);
const videoSources = harvest.map((v) => ({
  card: {
    title: v.title,
    cover: ytThumb(v.id),
    source: "storyberries",
    ageRange: v.ageRange || undefined, // undefined → mergeSources default "4-6"
  },
  media: { video: v.id },
}));

// Read cards first so their category age + real cover win when a video matches
// an existing read-along by title; video fills in the media.video slot.
let stories = mergeSources([...readSources, ...videoSources]);

// Fill page images for read-alongs that have no video, so they read in-app.
for (const s of stories) {
  if (!s.media.video && s.media.read) {
    try {
      s.media.pages = parseStoryPages(await getHtml(s.media.read)).slice(0, 30);
    } catch {
      /* leave pages empty */
    }
  }
}

// Prefer the real Storyberries book cover over the YouTube thumbnail.
const coverIndex = await buildCoverIndex();
backfillCovers(stories, coverIndex);

// Keep only records that play in-app: a video or read-along pages.
stories = stories.filter((s) => s.media.video || s.media.pages.length);

// Sort: video first, then in-app read-along.
const rank = (s) => (s.media.video ? 0 : 1);
stories.sort((a, b) => rank(a) - rank(b));

writeFileSync(
  new URL("../data/stories.json", import.meta.url),
  JSON.stringify(stories, null, 2)
);
const withVideo = stories.filter((s) => s.media.video).length;
console.log(
  `wrote ${stories.length} stories (${withVideo} video, ${stories.length - withVideo} read-along)`
);
