# Xia's Story Time — Design Spec

**Date:** 2026-09-16
**Type:** New project (static web app)
**For:** A personal bedtime/story app for the user's daughter, Xia (ages 4–6).

## 1. Purpose

A single-purpose, kid-friendly web app that shows a wall of big picture-book
covers in a 3-column grid. Xia taps a cover and it immediately plays the
animated **video**, plays the **audio** narration, or opens a swipeable
**read-along** — whichever that book has. Covers are the hero and the primary
tap target.

Content is sourced from [Storyberries](https://www.storyberries.com) — the
age 4–6 stories, plus their video and audio collections. This is a private
app for one child (personal use); it **streams/embeds** media from
Storyberries + YouTube rather than re-hosting their library.

## 2. Success Criteria

- A 3-column responsive grid of ~40 large cover tiles renders from a local
  catalog file.
- Tapping a cover opens a full-screen player that plays the richest media the
  book has: video → audio → read-along.
- Filter chips let a parent narrow to All / 🎬 Video / 🔊 Audio / 📖 Read.
- Works on a laptop, a tablet, and a 65" TV browser (big touch targets,
  keyboard/remote navigable).
- No backend, no build step. Opens as static files or from any static host
  (e.g. GitHub Pages).

## 3. Architecture

Plain static web app: HTML + CSS + vanilla JS. No framework, no bundler.
The app reads a pre-built JSON catalog at runtime and never scrapes live.

```
Build time (once, manual):
  scripts/scrape.mjs  ──fetch/parse──▶  data/stories.json   (curated ~40)

Runtime (in browser):
  index.html ─▶ js/app.js ─▶ fetch(data/stories.json)
                    │
                    ├─▶ render 3-column cover grid + filter chips
                    └─▶ on cover tap ─▶ js/player.js (full-screen overlay)
                                          ├─ video → YouTube iframe (autoplay)
                                          ├─ audio → <audio> + cover artwork
                                          └─ read  → swipeable page-image reader
```

## 4. Components

| File | Responsibility | Depends on |
|------|----------------|------------|
| `index.html` | App shell: header, grid container, overlay root | — |
| `css/styles.css` | Kid-friendly theme, 3-col grid, overlay, responsive/TV | — |
| `js/catalog.js` | Load & validate `stories.json`; derive badges + richest media | — |
| `js/app.js` | Render grid, filter chips, wire tap → player | catalog.js, player.js |
| `js/player.js` | Full-screen overlay; render video / audio / reader by media type | — |
| `data/stories.json` | The curated catalog (checked into repo) | — |
| `scripts/scrape.mjs` | One-time builder: fetch Storyberries pages, emit stories.json | — |
| `scripts/fixtures/*.html` | Saved HTML for scraper tests (no live network) | — |

Each unit is independently understandable and testable: `catalog.js` is pure
data logic (no DOM), `player.js` takes a story record and renders, `app.js`
orchestrates, `scrape.mjs` is a standalone Node script.

## 5. Data Model

`data/stories.json` is an array of story records:

```json
{
  "id": "the-window-seat",
  "title": "The Window Seat",
  "ageRange": "4-6",
  "cover": "https://www.storyberries.com/wp-content/uploads/.../cover.jpg",
  "media": {
    "video": "YOUTUBE_VIDEO_ID_OR_NULL",
    "audio": "https://.../narration.mp3_OR_NULL",
    "read":  "https://www.storyberries.com/.../story/_OR_NULL",
    "pages": ["https://.../page_1.jpg", "https://.../page_2.jpg"]
  }
}
```

Derived at load time by `catalog.js`:
- **badges**: the set of non-null media types → `["video","audio","read"]`.
- **primary**: richest available in priority order `video → audio → read`.
  Tapping the cover opens `primary`; badges hint at what's inside.

`pages` is only populated for read-along books (page-image URLs); empty
otherwise.

## 6. Content Acquisition (`scrape.mjs`)

Run manually once (and any time we refresh the library):

1. Fetch N pages of `/category/age-4-6-bedtime-stories/` → titles, story URLs,
   cover image URLs.
2. Fetch `/category/video-stories-for-kids/` and the audio/interactive-audio
   collection → build lookup of title → YouTube id / audio url.
3. Match age-4-6 stories to video/audio by normalized title where present.
4. For read-along books, collect page-image URLs from the story page.
5. Emit a candidate `stories.json`; the developer hand-trims to ~40, weighted
   toward records that have video and/or audio.

Runtime never depends on this — it only reads the committed JSON.

## 7. UI / UX

- **Home:** header with title "Xia's Story Time" + filter chips
  (All · 🎬 Video · 🔊 Audio · 📖 Read). Below: 3-column grid of large cover
  tiles. Each tile = cover image + title + small badge row. Minimal text; big
  tap targets; playful, high-contrast, soft rounded theme.
- **Player overlay:** full-screen, dark scrim, large ✕ close (also Esc /
  Back). 
  - 🎬 video: YouTube `<iframe>` with autoplay + related-off params.
  - 🔊 audio: large cover artwork + native audio controls; auto-plays.
  - 📖 read: swipeable/arrow-navigable page images with page counter.
- **Responsive:** 3 columns on desktop/TV; gracefully collapses to 2 then 1 on
  narrow screens. Focusable tiles for keyboard/remote (arrow keys + Enter).

## 8. Error Handling

- Broken/missing cover image → friendly placeholder tile.
- Video/audio fails to load → in-overlay message + "Open on Storyberries" link.
- No internet → gentle full-screen "Let's get online first 🌙" message
  (detected via failed catalog fetch or `navigator.onLine`).
- Empty filter result → "No stories here yet" message.

## 9. Testing

- **`catalog.js`**: unit tests for badge derivation and richest-media
  selection across combinations (video-only, audio+read, all three, none).
- **`scrape.mjs`**: tested against saved HTML fixtures in
  `scripts/fixtures/` — parsing produces expected records with no live
  network.
- **Manual/visual QA**: 3-column layout, cover tap → correct player, filters,
  responsive breakpoints, TV/keyboard nav — verified in a real browser via the
  browse tool.

## 10. Out of Scope (future)

Favorites / "Xia's shelf", parental PIN lock, offline caching (PWA), search,
reading-progress, multiple child profiles. Deliberately excluded to keep v1
focused on: covers → play.
