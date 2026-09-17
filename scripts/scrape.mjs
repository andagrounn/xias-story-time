import { writeFileSync } from "node:fs";
import { parseListing, parseStoryPages, mergeSources } from "./scrape-lib.js";

const AGE_PAGES = 6; // ~48 read-along candidates
const VIDEO_PAGES = 3; // animated video collection pages
const UA = { headers: { "User-Agent": "Mozilla/5.0 (personal reader)" } };

// NOTE: Storyberries has no clean single-file audio narration (its "interactive
// audio" is a fragmented sound-effect toy), so we don't source standalone audio.
// The narrated experience is the YouTube animation (media.video). player.js still
// supports an audio type if a good source is added later.

async function getHtml(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

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

const ytId = (html) => {
  const m = html.match(/youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)([\w-]{11})/);
  return m ? m[1] : null;
};

// For each media card, open its story page and extract the concrete media URL/id.
async function resolveMedia(cards, extract, key, label) {
  const sources = [];
  for (const card of cards) {
    try {
      const val = extract(await getHtml(card.url));
      if (val) sources.push({ card, media: { [key]: val, read: card.url } });
    } catch {
      /* ignore individual failures */
    }
  }
  console.log(`${label}: ${sources.length} resolved`);
  return sources;
}

const videoCards = await collect(
  "https://www.storyberries.com/category/video-stories-for-kids/",
  VIDEO_PAGES,
  "video"
);
const readCards = await collect(
  "https://www.storyberries.com/category/age-4-6-bedtime-stories/",
  AGE_PAGES,
  "read"
);

const videoSources = await resolveMedia(videoCards, ytId, "video", "video");
const readSources = readCards.map((card) => ({ card, media: { read: card.url } }));

let stories = mergeSources([...videoSources, ...readSources]);

// Fill page images for read-along books that have no video, to keep it light.
for (const s of stories) {
  if (!s.media.video && s.media.read) {
    try {
      s.media.pages = parseStoryPages(await getHtml(s.media.read)).slice(0, 30);
    } catch {
      /* leave pages empty */
    }
  }
}

// Keep only records that actually play something: a video, or read-along pages.
stories = stories.filter((s) => s.media.video || s.media.pages.length);

// Sort: richest media first (video, then read-along).
const rank = (s) => (s.media.video ? 0 : 1);
stories.sort((a, b) => rank(a) - rank(b));

writeFileSync(
  new URL("../data/stories.json", import.meta.url),
  JSON.stringify(stories, null, 2)
);
const withVideo = stories.filter((s) => s.media.video).length;
console.log(`wrote ${stories.length} stories (${withVideo} video, ${stories.length - withVideo} read-along)`);
