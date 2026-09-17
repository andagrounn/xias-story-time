import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStories, storyCardHTML, availableChips } from "../js/app.js";

const stories = [
  { id: "a", title: "A", cover: "a.jpg", badges: ["video"], primary: "video", media: { video: "yt" } },
  { id: "b", title: "B & <b>", cover: "b.jpg", badges: ["read"], primary: "read", media: { read: "u", pages: ["p1"] } },
];

test("filterStories all returns everything", () => {
  assert.equal(filterStories(stories, "all").length, 2);
});

test("filterStories video returns only video-badged", () => {
  assert.deepEqual(filterStories(stories, "video").map((s) => s.id), ["a"]);
});

test("filterStories read returns only read-badged", () => {
  assert.deepEqual(filterStories(stories, "read").map((s) => s.id), ["b"]);
});

test("availableChips lists only non-empty types plus all", () => {
  assert.deepEqual(availableChips(stories), ["all", "video", "read"]);
});

test("storyCardHTML includes title, cover, badges, id, and escapes html", () => {
  const html = storyCardHTML(stories[0]);
  assert.match(html, /a\.jpg/);
  assert.match(html, /data-id="a"/);
  assert.match(html, /🎬/);
  assert.match(storyCardHTML(stories[1]), /B &amp; &lt;b&gt;/);
});
