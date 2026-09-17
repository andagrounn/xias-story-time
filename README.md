# Xia's Story Time 🌙

A cozy 3-column picture-book wall for Xia (ages 4–6). Tap a cover to watch its
animated video or read along page by page. Content streams from Storyberries +
YouTube — nothing is re-hosted.

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
reads `data/stories.json`. It keeps only stories that actually play something (a
video or read-along pages) and puts videos first.

Note: Storyberries has no clean single-file audio narration (its "interactive
audio" is a fragmented sound-effect toy), so the catalog ships **video** and
**read-along** only. The narrated experience is the animated video. The player
still supports an audio type if a good source is added later.

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
