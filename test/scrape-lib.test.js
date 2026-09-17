import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeTitle, parseListing, mergeSources, parseStoryPages } from "../scripts/scrape-lib.js";

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

test("parseStoryPages prefers lazy-src and rejects SVG/UI placeholders", () => {
  const html = `<div class="entry-content">
    <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" data-lazy-src="https://s/page_1.jpg" />
    <img src="https://s/page_2.jpg" />
    <img src="https://s/logo.png" />
    <img data-src="https://s/readmio-banner.jpg" />
  </div>`;
  const pages = parseStoryPages(html);
  assert.deepEqual(pages, ["https://s/page_1.jpg", "https://s/page_2.jpg"]);
});

test("mergeSources dedupes by title and merges media across sources", () => {
  const out = mergeSources([
    { card: { title: "The Window Seat", url: "read-url", cover: "book.jpg" }, media: { read: "read-url" } },
    { card: { title: "The Window Seat!", cover: "video-thumb.jpg" }, media: { video: "YT123" } },
    { card: { title: "Solo Audio", url: "a-url", cover: "a.jpg" }, media: { audio: "n.mp3", read: "a-url" } },
  ]);
  assert.equal(out.length, 2);
  const ws = out.find((r) => r.title === "The Window Seat");
  assert.equal(ws.media.video, "YT123");
  assert.equal(ws.media.read, "read-url");
  assert.equal(ws.cover, "book.jpg"); // first non-empty cover wins
  assert.equal(ws.id, "the-window-seat");
  const audio = out.find((r) => r.title === "Solo Audio");
  assert.equal(audio.media.audio, "n.mp3");
});
