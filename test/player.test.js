import { test } from "node:test";
import assert from "node:assert/strict";
import { playerMarkup } from "../js/player.js";

test("video story yields a youtube embed with its id", () => {
  const html = playerMarkup({ title: "V", primary: "video", media: { video: "YT12345" } });
  assert.match(html, /youtube(?:-nocookie)?\.com\/embed\/YT12345/);
  assert.match(html, /iframe/);
});

test("audio story yields an audio element with cover artwork", () => {
  const html = playerMarkup({
    title: "A", cover: "https://s/c.jpg", primary: "audio", media: { audio: "https://s/n.mp3" },
  });
  assert.match(html, /<audio[^>]+src="https:\/\/s\/n\.mp3"/);
  assert.match(html, /https:\/\/s\/c\.jpg/);
});

test("read story yields a reader with page images and counter", () => {
  const html = playerMarkup({
    title: "R", primary: "read",
    media: { read: "https://s/u", pages: ["https://s/p1.jpg", "https://s/p2.jpg"] },
  });
  assert.match(html, /https:\/\/s\/p1\.jpg/);
  assert.match(html, /reader/);
  assert.match(html, /1 \/ 2/);
  assert.doesNotMatch(html, /class="narrate"/); // no toggle without narration
});

test("read story with narration adds a toggle + audio track", () => {
  const html = playerMarkup({
    title: "R", primary: "read",
    media: { read: "https://s/u", pages: ["https://s/p1.jpg"], narration: "https://s/story.mp3" },
  });
  assert.match(html, /class="narrate"/);
  assert.match(html, /<audio[^>]+class="narration"[^>]+src="https:\/\/s\/story\.mp3"/);
});

test("non-http(s) urls are dropped from attributes (XSS defense)", () => {
  const html = playerMarkup({
    title: "X", primary: "read",
    media: { read: `javascript:alert(1)"><script>`, pages: [] },
  });
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /href=""/); // scrubbed to empty
});

test("read story with no pages falls back to a link out", () => {
  const html = playerMarkup({ title: "R", primary: "read", media: { read: "https://s/story", pages: [] } });
  assert.match(html, /https:\/\/s\/story/);
});
