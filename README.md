# Xia's Story Time 🌙

A cozy 3-column picture-book wall for Xia (ages 4–6). Tap a cover to watch its
animated video, read along page by page, or open a book in the library. Content
streams from Storyberries, StoryWeaver, and YouTube — nothing is re-hosted.

Three kinds of story:

- **🎬 Video** — an animated read-along on YouTube (plays in-app).
- **📖 Read** — a page-by-page picture book you turn in-app (Storyberries).
- **📚 Library** — an openly-licensed book that opens on StoryWeaver.

## Run it

Serve the folder from any static server (not `file://`, so the catalog loads):

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123

Works on a laptop, tablet, or the big TV browser. Arrow keys turn read-along
pages; Esc closes the player.

## Refresh the library

```bash
npm install      # once, for the scraper's dev dependency
npm run scrape   # rebuilds data/stories.json
```

The scraper is a one-time build step. The app itself never scrapes — it only
reads `data/stories.json`. It keeps any story that offers something to do (a
video, in-app read-along pages, or a library link) and puts videos first.

Sources:

- **Storyberries** — animated video stories + in-app read-along picture books
  (page images scraped from the story page).
- **StoryWeaver** (Pratham Books) — openly-licensed (CC-BY) Level 1–2 English
  picture books via the public `books-search` API. Their reader is form-gated,
  so these are **library** cards that open on StoryWeaver.
- **YouTube video matching** — after building the catalog, the scraper searches
  YouTube for each story and attaches a video **only** when the top hit comes
  from a vetted channel (Storyberries, Storyline Online, Pratham Books) *and* its
  title covers the story title (`bestVideoMatch`). Anything else → no video. This
  is what keeps auto-linking safe for a 4–6 audience — a mismatch adds nothing
  rather than the wrong video. To trust more channels, add their channel ID to
  `VETTED` in `scripts/scrape.mjs`.

Note: Storyberries has no clean single-file audio narration (its "interactive
audio" is a fragmented sound-effect toy), so the catalog ships **video**,
**read-along**, and **library** only. The player still supports an audio type if
a good source is added later.

## Test

```bash
npm test
```

## Layout

- `index.html`, `css/styles.css` — shell + kid-friendly theme
- `js/catalog.js` — load catalog, derive capability badges + primary media
- `js/app.js` — 3-column grid + filter chips
- `js/player.js` — full-screen video / read-along player
- `data/stories.json` — the committed catalog
- `scripts/scrape.mjs` + `scripts/scrape-lib.js` — the one-time builder
- `test/` — Node test-runner specs
