# Xia's Story Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, kid-friendly web app that shows a 3-column grid of ~40 Storyberries book covers; tapping a cover plays its animated video, audio narration, or opens a swipeable read-along.

**Architecture:** Plain static app (HTML + CSS + vanilla ES-module JS, no framework, no bundler). A one-time Node script scrapes Storyberries into a committed `data/stories.json`; the browser app only reads that JSON and streams/embeds media from Storyberries + YouTube. Pure data/markup logic lives in importable modules that run in both Node (for tests) and the browser (for the app); DOM wiring stays thin.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES modules). Node.js built-in test runner (`node --test`) for tests. `node-html-parser` as the only dev dependency (used solely by the scraper; the shipped app has zero runtime dependencies).

**Spec:** `docs/superpowers/specs/2026-09-16-xias-story-time-design.md`

## Global Constraints

- **App name (exact copy):** "Xia's Story Time".
- **Shipped app has zero runtime dependencies** — only `index.html`, `css/`, `js/`, `data/` are served. `node-html-parser` is a **devDependency**, used only by `scripts/`.
- **ES modules everywhere** — `package.json` has `"type": "module"`; browser scripts load via `<script type="module">`. The same `.js` files import in Node tests and in the browser, so no Node-only APIs in `js/` modules.
- **Media is streamed, never re-hosted** — records store URLs / YouTube IDs; the app embeds them.
- **Media priority order is `video → audio → read`** everywhere (badges + primary pick).
- **Run the app from a static server** (e.g. `python3 -m http.server`), not `file://`, so `fetch('data/stories.json')` works.
- **Catalog target:** ~40 curated stories, weighted toward records that have `video` and/or `audio`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | ESM flag, `test` script, `node-html-parser` devDependency |
| `js/catalog.js` | Pure: derive badges, pick primary media, normalize record, load catalog |
| `js/app.js` | Render grid + filter chips; wire tap → player (thin DOM) |
| `js/player.js` | Pure markup builders + full-screen overlay controller |
| `css/styles.css` | Kid-friendly theme, 3-col responsive grid, overlay |
| `index.html` | App shell |
| `data/stories.json` | Committed curated catalog (~40) |
| `scripts/scrape-lib.js` | Pure: title normalize, parse listing/story HTML, match media |
| `scripts/scrape.mjs` | Runner: fetch pages, call scrape-lib, emit stories.json |
| `scripts/fixtures/*.html` | Saved real HTML for scraper tests (no live network) |
| `test/*.test.js` | Node test-runner specs |
| `README.md` | How to run, how to refresh the catalog |

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`
- Create: `test/harness.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test`; `"type": "module"` enabled for all later tasks.

- [ ] **Step 1: Write the failing test**

`test/harness.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("test harness runs", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"` (no package.json yet).

- [ ] **Step 3: Write minimal implementation**

`package.json`:
```json
{
  "name": "xias-story-time",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "scrape": "node scripts/scrape.mjs"
  },
  "devDependencies": {
    "node-html-parser": "^6.1.13"
  }
}
```
Then run: `npm install`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json test/harness.test.js
git commit -m "chore: scaffold project and node test harness"
```

---

### Task 2: Catalog logic (`js/catalog.js`)

**Files:**
- Create: `js/catalog.js`
- Test: `test/catalog.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MEDIA_PRIORITY: string[]` = `["video", "audio", "read"]`
  - `deriveBadges(media: object): string[]` — present media keys in priority order
  - `pickPrimary(media: object): string|null` — first present in priority order
  - `normalizeStory(raw: object): object` — adds `badges` and `primary`
  - `loadCatalog(url?: string, fetchFn?: function): Promise<object[]>` — fetch + normalize

- [ ] **Step 1: Write the failing test**

`test/catalog.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBadges, pickPrimary, normalizeStory, loadCatalog } from "../js/catalog.js";

test("deriveBadges returns present media in priority order", () => {
  assert.deepEqual(deriveBadges({ video: "abc", audio: null, read: "u" }), ["video", "read"]);
  assert.deepEqual(deriveBadges({ audio: "a", read: "u", video: null }), ["audio", "read"]);
  assert.deepEqual(deriveBadges({}), []);
});

test("pickPrimary picks richest available", () => {
  assert.equal(pickPrimary({ video: "abc", audio: "a", read: "u" }), "video");
  assert.equal(pickPrimary({ audio: "a", read: "u" }), "audio");
  assert.equal(pickPrimary({ read: "u" }), "read");
  assert.equal(pickPrimary({}), null);
});

test("normalizeStory adds badges and primary", () => {
  const s = normalizeStory({ id: "x", title: "X", media: { audio: "a", read: "u" } });
  assert.deepEqual(s.badges, ["audio", "read"]);
  assert.equal(s.primary, "audio");
});

test("loadCatalog fetches and normalizes each record", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => [{ id: "x", title: "X", media: { video: "yt" } }],
  });
  const out = await loadCatalog("data/stories.json", fakeFetch);
  assert.equal(out[0].primary, "video");
  assert.deepEqual(out[0].badges, ["video"]);
});

test("loadCatalog throws on non-ok response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => loadCatalog("x", fakeFetch), /404/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../js/catalog.js`.

- [ ] **Step 3: Write minimal implementation**

`js/catalog.js`:
```js
export const MEDIA_PRIORITY = ["video", "audio", "read"];

export function deriveBadges(media) {
  return MEDIA_PRIORITY.filter((k) => media && media[k]);
}

export function pickPrimary(media) {
  return MEDIA_PRIORITY.find((k) => media && media[k]) ?? null;
}

export function normalizeStory(raw) {
  return { ...raw, badges: deriveBadges(raw.media), primary: pickPrimary(raw.media) };
}

export async function loadCatalog(url = "data/stories.json", fetchFn = fetch) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const data = await res.json();
  return data.map(normalizeStory);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all catalog tests green.

- [ ] **Step 5: Commit**

```bash
git add js/catalog.js test/catalog.test.js
git commit -m "feat: catalog badge + primary-media logic with loader"
```

---

### Task 3: Scraper parsing library (`scripts/scrape-lib.js`)

**Files:**
- Create: `scripts/scrape-lib.js`
- Create: `scripts/fixtures/listing.html` (captured real HTML — see Step 1)
- Test: `test/scrape-lib.test.js`

**Interfaces:**
- Consumes: `node-html-parser` `parse`.
- Produces:
  - `normalizeTitle(t: string): string` — lowercased, alphanumeric-collapsed key for matching
  - `parseListing(html: string): {title, url, cover}[]` — story cards from a category page
  - `parseStoryPages(html: string): string[]` — page-image URLs from a story page
  - `matchMedia(stories: object[], videoIndex: Map, audioIndex: Map): object[]` — attach video/audio by normalized title

- [ ] **Step 1: Capture a real fixture**

Save a real listing page so the parser is written against true markup (not guesses):
```bash
mkdir -p scripts/fixtures
curl -sL "https://www.storyberries.com/category/age-4-6-bedtime-stories/" -o scripts/fixtures/listing.html
```
Open `scripts/fixtures/listing.html` and note the actual element/class used for each story card, its title link, and its cover `<img>` (including any `data-src` lazy-load attribute). The known titles on page 1 include "The Window Seat", "Long-Legged Bob", "The Circus School".

- [ ] **Step 2: Write the failing test**

`test/scrape-lib.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeTitle, parseListing, matchMedia } from "../scripts/scrape-lib.js";

const listing = readFileSync(new URL("../scripts/fixtures/listing.html", import.meta.url), "utf8");

test("normalizeTitle collapses to a match key", () => {
  assert.equal(normalizeTitle("The OTHER Superheroes!"), "the other superheroes");
  assert.equal(normalizeTitle("Dawn Elizabeth Daly's Pet"), "dawn elizabeth daly s pet");
});

test("parseListing extracts story cards with title, url, cover", () => {
  const cards = parseListing(listing);
  assert.ok(cards.length >= 8, `expected >=8 cards, got ${cards.length}`);
  const titles = cards.map((c) => c.title);
  assert.ok(titles.includes("The Window Seat"));
  const ws = cards.find((c) => c.title === "The Window Seat");
  assert.match(ws.url, /^https:\/\/www\.storyberries\.com\//);
  assert.match(ws.cover, /\.(jpg|jpeg|png)/i);
});

test("matchMedia attaches video/audio by normalized title", () => {
  const stories = [{ title: "The Window Seat", url: "u", cover: "c" }];
  const videoIndex = new Map([["the window seat", "YT123"]]);
  const audioIndex = new Map();
  const out = matchMedia(stories, videoIndex, audioIndex);
  assert.equal(out[0].media.video, "YT123");
  assert.equal(out[0].media.audio, null);
  assert.equal(out[0].media.read, "u");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../scripts/scrape-lib.js`.

- [ ] **Step 4: Write minimal implementation**

`scripts/scrape-lib.js` (adjust the selectors in `parseListing` until the test passes against your captured fixture):
```js
import { parse } from "node-html-parser";

export function normalizeTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseListing(html) {
  const root = parse(html);
  // Adjust selectors to match scripts/fixtures/listing.html markup.
  const cards = root.querySelectorAll("article, .post");
  return cards
    .map((card) => {
      const link = card.querySelector("h2 a, .entry-title a, a.entry-title-link");
      const img = card.querySelector("img");
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
  const imgs = root.querySelectorAll(".entry-content img, article img");
  return imgs
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — parsing extracts the known titles from the fixture.

- [ ] **Step 6: Commit**

```bash
git add scripts/scrape-lib.js scripts/fixtures/listing.html test/scrape-lib.test.js
git commit -m "feat: scraper parsing library with fixture-based tests"
```

---

### Task 4: Scraper runner + generate the catalog (`scripts/scrape.mjs`, `data/stories.json`)

**Files:**
- Create: `scripts/scrape.mjs`
- Create: `data/stories.json` (generated, then hand-curated)

**Interfaces:**
- Consumes: `scrape-lib.js` (`parseListing`, `parseStoryPages`, `normalizeTitle`, `matchMedia`).
- Produces: a committed `data/stories.json` array of records shaped for `normalizeStory` (Task 2). This is a **data-generation** task (live network), not a TDD unit — the parsing it relies on is already tested in Task 3.

- [ ] **Step 1: Write the runner**

`scripts/scrape.mjs`:
```js
import { writeFileSync } from "node:fs";
import { parseListing, parseStoryPages, normalizeTitle, matchMedia } from "./scrape-lib.js";

const AGE_PAGES = 6;            // ~48 candidate stories
const UA = { headers: { "User-Agent": "Mozilla/5.0 (personal reader)" } };

async function getHtml(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function collectListing() {
  const out = [];
  for (let p = 1; p <= AGE_PAGES; p++) {
    const url = p === 1
      ? "https://www.storyberries.com/category/age-4-6-bedtime-stories/"
      : `https://www.storyberries.com/category/age-4-6-bedtime-stories/page/${p}/`;
    console.log("listing", url);
    out.push(...parseListing(await getHtml(url)));
  }
  return out;
}

// Build title -> youtubeId and title -> audioUrl indexes from the media collections.
async function buildIndex(categoryUrl, extract) {
  const index = new Map();
  const html = await getHtml(categoryUrl);
  for (const card of parseListing(html)) {
    const media = await extract(card).catch(() => null);
    if (media) index.set(normalizeTitle(card.title), media);
  }
  return index;
}

const ytId = (html) => {
  const m = html.match(/youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)([\w-]{11})/);
  return m ? m[1] : null;
};
const audioSrc = (html) => {
  const m = html.match(/<audio[^>]*>[\s\S]*?<source[^>]+src="([^"]+)"/i) ||
            html.match(/<audio[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
};

const videoIndex = await buildIndex(
  "https://www.storyberries.com/category/video-stories-for-kids/",
  async (c) => ytId(await getHtml(c.url))
);
const audioIndex = await buildIndex(
  "https://www.storyberries.com/category/kids-stories-with-interactive-audio/",
  async (c) => audioSrc(await getHtml(c.url))
);

const stories = matchMedia(await collectListing(), videoIndex, audioIndex);

// Fill page images only for read-along books lacking video+audio (keeps it light).
for (const s of stories) {
  if (!s.media.video && !s.media.audio && s.media.read) {
    s.media.pages = parseStoryPages(await getHtml(s.media.read)).slice(0, 30);
  }
}

writeFileSync(new URL("../data/stories.json", import.meta.url),
  JSON.stringify(stories, null, 2));
console.log(`wrote ${stories.length} stories`);
```

- [ ] **Step 2: Run the scraper**

Run: `npm run scrape`
Expected: prints listing/media URLs and `wrote N stories`; creates `data/stories.json`.

- [ ] **Step 3: Curate to ~40**

Open `data/stories.json`. Keep ~40 records, **sorted so those with `media.video` and/or `media.audio` come first**. Delete broken/empty entries. Spot-check 3–4 records: cover URL loads in a browser, YouTube ID resolves (`https://youtu.be/<id>`), audio URL plays. This is the human-taste gate the design calls for.

- [ ] **Step 4: Commit**

```bash
git add scripts/scrape.mjs data/stories.json
git commit -m "feat: catalog scraper runner and curated stories.json"
```

---

### Task 5: App shell + cover grid + filters (`index.html`, `css/styles.css`, `js/app.js`)

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/app.js`
- Test: `test/app.test.js`

**Interfaces:**
- Consumes: `catalog.js` (`loadCatalog`, normalized records with `badges`/`primary`).
- Produces:
  - `BADGE_ICON: {video,audio,read}` map to emoji
  - `filterStories(stories: object[], type: string): object[]` — `type` in `all|video|audio|read`
  - `storyCardHTML(story: object): string` — one grid tile's HTML
  - `initApp(root, stories, onOpen)` — renders chips + grid, calls `onOpen(story)` on tile activate

- [ ] **Step 1: Write the failing test**

`test/app.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStories, storyCardHTML } from "../js/app.js";

const stories = [
  { id: "a", title: "A", cover: "a.jpg", badges: ["video"], primary: "video", media: { video: "yt" } },
  { id: "b", title: "B", cover: "b.jpg", badges: ["audio", "read"], primary: "audio", media: { audio: "u" } },
];

test("filterStories all returns everything", () => {
  assert.equal(filterStories(stories, "all").length, 2);
});

test("filterStories video returns only video-badged", () => {
  const out = filterStories(stories, "video");
  assert.deepEqual(out.map((s) => s.id), ["a"]);
});

test("filterStories read returns only read-badged", () => {
  assert.deepEqual(filterStories(stories, "read").map((s) => s.id), ["b"]);
});

test("storyCardHTML includes title, cover, badges, and id", () => {
  const html = storyCardHTML(stories[0]);
  assert.match(html, /A</);
  assert.match(html, /a\.jpg/);
  assert.match(html, /data-id="a"/);
  assert.match(html, /🎬/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../js/app.js`.

- [ ] **Step 3: Write minimal implementation**

`js/app.js`:
```js
import { loadCatalog } from "./catalog.js";

export const BADGE_ICON = { video: "🎬", audio: "🔊", read: "📖" };

export function filterStories(stories, type) {
  if (type === "all") return stories;
  return stories.filter((s) => s.badges.includes(type));
}

export function storyCardHTML(story) {
  const badges = story.badges.map((b) => BADGE_ICON[b]).join(" ");
  return `
    <button class="card" data-id="${story.id}" aria-label="Play ${escapeHtml(story.title)}">
      <img class="card-cover" src="${story.cover}" alt="" loading="lazy"
           onerror="this.classList.add('missing')" />
      <span class="card-title">${escapeHtml(story.title)}</span>
      <span class="card-badges">${badges}</span>
    </button>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function initApp(root, stories, onOpen) {
  const chips = ["all", "video", "audio", "read"];
  const grid = root.querySelector("#grid");
  const chipBar = root.querySelector("#chips");
  let active = "all";

  const render = () => {
    const shown = filterStories(stories, active);
    grid.innerHTML = shown.length
      ? shown.map(storyCardHTML).join("")
      : `<p class="empty">No stories here yet 🌙</p>`;
  };

  chipBar.innerHTML = chips
    .map((c) => `<button class="chip${c === active ? " on" : ""}" data-type="${c}">
      ${c === "all" ? "All" : BADGE_ICON[c] + " " + c[0].toUpperCase() + c.slice(1)}</button>`)
    .join("");

  chipBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    active = chip.dataset.type;
    chipBar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
    render();
  });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    onOpen(stories.find((s) => s.id === card.dataset.id));
  });

  render();
}

// Bootstrap (skipped in Node tests, which import only the pure functions).
if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  loadCatalog()
    .then((stories) => {
      import("./player.js").then(({ openPlayer }) => initApp(root, stories, openPlayer));
    })
    .catch(() => {
      root.querySelector("#grid").innerHTML =
        `<p class="empty">Let's get online first 🌙</p>`;
    });
}
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xia's Story Time</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="app">
    <header class="app-header">
      <h1>Xia's Story Time</h1>
      <nav id="chips" class="chips"></nav>
    </header>
    <section id="grid" class="grid"></section>
    <div id="overlay" class="overlay hidden" aria-hidden="true"></div>
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

`css/styles.css`:
```css
:root { --gap: 20px; --radius: 18px; --bg: #1b1035; --card: #2a1a52; --text: #fff; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Baloo 2", "Comic Sans MS", system-ui, sans-serif;
  background: radial-gradient(circle at 50% -10%, #3a1e6e, var(--bg)); color: var(--text); }
.app-header { padding: 24px; text-align: center; }
.app-header h1 { font-size: clamp(28px, 5vw, 48px); margin: 0 0 16px; }
.chips { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.chip { border: none; border-radius: 999px; padding: 10px 20px; font-size: 18px;
  background: #47317e; color: #fff; cursor: pointer; }
.chip.on { background: #ffcf4d; color: #3a1e6e; font-weight: 700; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap);
  padding: var(--gap); max-width: 1400px; margin: 0 auto; }
.card { display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: var(--card); border: none; border-radius: var(--radius); padding: 12px;
  cursor: pointer; color: #fff; transition: transform .12s; }
.card:hover, .card:focus-visible { transform: translateY(-6px) scale(1.02);
  outline: 4px solid #ffcf4d; }
.card-cover { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px;
  background: #47317e; }
.card-cover.missing { background: #47317e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffcf4d'%3E%3Cpath d='M4 4h16v16H4z' opacity='.2'/%3E%3Ctext x='12' y='15' text-anchor='middle' font-size='9' fill='%23ffcf4d'%3E📖%3C/text%3E%3C/svg%3E") center/40% no-repeat; }
.card-title { font-size: clamp(15px, 1.6vw, 20px); text-align: center; line-height: 1.2; }
.card-badges { font-size: 18px; }
.empty { grid-column: 1 / -1; text-align: center; font-size: 24px; padding: 60px; }
@media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — filter + card tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/app.js test/app.test.js
git commit -m "feat: app shell, 3-column cover grid, and filter chips"
```

---

### Task 6: Full-screen player overlay (`js/player.js`)

**Files:**
- Create: `js/player.js`
- Modify: `css/styles.css` (append overlay styles)
- Test: `test/player.test.js`

**Interfaces:**
- Consumes: normalized story record (`primary`, `media`).
- Produces:
  - `playerMarkup(story: object): string` — inner HTML for the overlay body, chosen by `story.primary`
  - `openPlayer(story: object): void` — fills `#overlay`, shows it, wires close (✕ / Esc / backdrop)
  - `closePlayer(): void`

- [ ] **Step 1: Write the failing test**

`test/player.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { playerMarkup } from "../js/player.js";

test("video story yields a youtube embed with its id", () => {
  const html = playerMarkup({ title: "V", primary: "video", media: { video: "YT12345" } });
  assert.match(html, /youtube(?:-nocookie)?\.com\/embed\/YT12345/);
  assert.match(html, /iframe/);
});

test("audio story yields an audio element with cover artwork", () => {
  const html = playerMarkup({ title: "A", cover: "c.jpg", primary: "audio", media: { audio: "n.mp3" } });
  assert.match(html, /<audio[^>]+src="n\.mp3"/);
  assert.match(html, /c\.jpg/);
});

test("read story yields a reader with page images and counter", () => {
  const html = playerMarkup({
    title: "R", primary: "read",
    media: { read: "u", pages: ["p1.jpg", "p2.jpg"] },
  });
  assert.match(html, /p1\.jpg/);
  assert.match(html, /reader/);
});

test("read story with no pages falls back to a link out", () => {
  const html = playerMarkup({ title: "R", primary: "read", media: { read: "https://s/story", pages: [] } });
  assert.match(html, /https:\/\/s\/story/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../js/player.js`.

- [ ] **Step 3: Write minimal implementation**

`js/player.js`:
```js
export function playerMarkup(story) {
  const { primary, media } = story;
  if (primary === "video") {
    return `<iframe class="stage" src="https://www.youtube-nocookie.com/embed/${media.video}?autoplay=1&rel=0"
      title="${story.title}" allow="autoplay; fullscreen" allowfullscreen frameborder="0"></iframe>`;
  }
  if (primary === "audio") {
    return `<div class="audio-stage">
      <img class="audio-art" src="${story.cover}" alt="" />
      <audio controls autoplay src="${media.audio}"></audio>
    </div>`;
  }
  if (primary === "read" && media.pages && media.pages.length) {
    const pages = media.pages
      .map((p, i) => `<img class="page${i === 0 ? " on" : ""}" src="${p}" alt="Page ${i + 1}" />`)
      .join("");
    return `<div class="reader" data-page="0" data-total="${media.pages.length}">
      <button class="nav prev" aria-label="Previous page">‹</button>
      <div class="pages">${pages}</div>
      <button class="nav next" aria-label="Next page">›</button>
      <span class="counter">1 / ${media.pages.length}</span>
    </div>`;
  }
  return `<div class="linkout">
    <p>This story opens on Storyberries.</p>
    <a class="linkout-btn" href="${media.read}" target="_blank" rel="noopener">Open the book 📖</a>
  </div>`;
}

export function closePlayer() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = "";
  document.removeEventListener("keydown", onKey);
}

function onKey(e) {
  const reader = document.querySelector("#overlay .reader");
  if (e.key === "Escape") return closePlayer();
  if (reader && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    turnPage(reader, e.key === "ArrowRight" ? 1 : -1);
  }
}

function turnPage(reader, dir) {
  const total = Number(reader.dataset.total);
  let page = Number(reader.dataset.page);
  page = Math.min(total - 1, Math.max(0, page + dir));
  reader.dataset.page = page;
  reader.querySelectorAll(".page").forEach((p, i) => p.classList.toggle("on", i === page));
  reader.querySelector(".counter").textContent = `${page + 1} / ${total}`;
}

export function openPlayer(story) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `
    <button class="overlay-close" aria-label="Close">✕</button>
    <div class="overlay-body">${playerMarkup(story)}</div>`;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  overlay.querySelector(".overlay-close").addEventListener("click", closePlayer);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePlayer(); });
  const reader = overlay.querySelector(".reader");
  if (reader) {
    reader.querySelector(".next").addEventListener("click", () => turnPage(reader, 1));
    reader.querySelector(".prev").addEventListener("click", () => turnPage(reader, -1));
  }
  document.addEventListener("keydown", onKey);
}
```

Append to `css/styles.css`:
```css
.overlay { position: fixed; inset: 0; background: rgba(10, 4, 30, .92);
  display: flex; align-items: center; justify-content: center; z-index: 50; }
.overlay.hidden { display: none; }
.overlay-body { width: min(92vw, 1100px); }
.overlay-close { position: absolute; top: 18px; right: 22px; font-size: 30px;
  background: #ffcf4d; color: #3a1e6e; border: none; border-radius: 999px;
  width: 56px; height: 56px; cursor: pointer; }
.stage { width: 100%; aspect-ratio: 16/9; border-radius: 16px; }
.audio-stage { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.audio-art { width: min(60vw, 420px); aspect-ratio: 3/4; object-fit: cover; border-radius: 16px; }
.reader { position: relative; display: flex; align-items: center; justify-content: center; }
.reader .pages { width: 100%; }
.page { display: none; width: 100%; max-height: 82vh; object-fit: contain; border-radius: 12px; }
.page.on { display: block; }
.nav { position: absolute; top: 50%; transform: translateY(-50%); font-size: 40px;
  background: rgba(255,207,77,.9); color: #3a1e6e; border: none; border-radius: 999px;
  width: 64px; height: 64px; cursor: pointer; }
.nav.prev { left: 8px; } .nav.next { right: 8px; }
.counter { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.5); padding: 6px 14px; border-radius: 999px; }
.linkout { text-align: center; }
.linkout-btn { display: inline-block; margin-top: 12px; background: #ffcf4d; color: #3a1e6e;
  padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all four player markup tests green.

- [ ] **Step 5: Commit**

```bash
git add js/player.js css/styles.css test/player.test.js
git commit -m "feat: full-screen player for video, audio, and read-along"
```

---

### Task 7: Integration, README, and browser QA

**Files:**
- Create: `README.md`
- Modify: any file needing fixes found during QA.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified, runnable app + run/refresh docs.

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# Xia's Story Time 🌙

A cozy 3-column picture-book wall for Xia (ages 4–6). Tap a cover to play its
animated video, hear the narration, or read along. Content streams from
Storyberries + YouTube.

## Run it
Serve the folder from any static server (not `file://`):

    python3 -m http.server 8000

Then open http://localhost:8000

## Refresh the library
    npm install      # once, for the scraper's dev dependency
    npm run scrape   # rebuilds data/stories.json, then hand-curate to ~40

## Test
    npm test
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — harness, catalog, scrape-lib, app, player suites all green.

- [ ] **Step 3: Browser QA**

Start `python3 -m http.server 8000`, then open the site and verify with the browse tool (screenshots for evidence):
- Grid shows 3 columns on a wide viewport; collapses to 2 then 1 when narrowed.
- Covers render; a broken cover URL shows the placeholder, not a broken image.
- Filter chips switch the shown set (All / 🎬 / 🔊 / 📖); empty filter shows the friendly message.
- Tapping a 🎬 cover autoplays the YouTube video; ✕, Esc, and backdrop all close it.
- Tapping a 🔊 cover plays audio with cover artwork.
- Tapping a 📖 cover pages through images with ‹ › and arrow keys; counter updates.
- Keyboard: Tab focuses tiles, Enter opens the player.
Fix any issue found, committing each fix atomically.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: add README with run and refresh instructions"
```

---

## Self-Review

**Spec coverage:**
- 3-column grid of ~40 covers → Task 5 (grid) + Task 4 (catalog).
- Tap plays richest media (video→audio→read) → Task 2 (`pickPrimary`) + Task 6 (`playerMarkup`).
- Filter chips All/video/audio/read → Task 5 (`filterStories`, chip bar).
- Video (YouTube embed) / audio / read-along reader → Task 6.
- Build-time scrape, runtime reads JSON only → Tasks 3–4; app never scrapes.
- Streamed, not re-hosted → records store URLs/IDs; embeds in Task 6.
- Error handling: broken cover placeholder (Task 5), unavailable media link-out (Task 6), no-internet screen (Task 5 bootstrap `catch`), empty filter (Task 5) → all covered.
- Responsive / TV / keyboard nav → Task 5 CSS breakpoints + focusable `<button>` tiles; Task 6 Esc/arrow keys.
- Testing: catalog + scrape-lib + app + player unit tests; browser QA → Tasks 2,3,5,6,7.
- Out-of-scope items (favorites, PIN, offline, search) → correctly absent.

**Placeholder scan:** No TBD/TODO; every code step has concrete content. The only intentionally human step is Task 4 Step 3 (curation) — a taste gate the spec explicitly calls for, with concrete acceptance checks.

**Type consistency:** `deriveBadges`/`pickPrimary`/`normalizeStory`/`loadCatalog` (Task 2) are consumed with matching names in Tasks 5–6. `filterStories`/`storyCardHTML`/`initApp` (Task 5) and `playerMarkup`/`openPlayer`/`closePlayer` (Task 6) match their test imports. Record shape (`id`, `title`, `cover`, `media.{video,audio,read,pages}`, derived `badges`/`primary`) is consistent across `matchMedia` (Task 3), the catalog (Task 4), and consumers (Tasks 5–6).
