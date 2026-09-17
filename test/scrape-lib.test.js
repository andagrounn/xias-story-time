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
