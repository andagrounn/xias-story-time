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
  assert.match(html, /1 \/ 2/);
});

test("read story with no pages falls back to a link out", () => {
  const html = playerMarkup({ title: "R", primary: "read", media: { read: "https://s/story", pages: [] } });
  assert.match(html, /https:\/\/s\/story/);
});
