import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStories, filterByAge, storyCardHTML, availableChips, availableAges } from "../js/app.js";

const stories = [
  { id: "a", title: "A", cover: "a.jpg", ageRange: "4-6", badges: ["video"], primary: "video", media: { video: "yt" } },
  { id: "b", title: "B & <b>", cover: "b.jpg", ageRange: "7-12", badges: ["read"], primary: "read", media: { read: "u", pages: ["p1"] } },
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

test("filterByAge narrows to one age range, all keeps everything", () => {
  assert.deepEqual(filterByAge(stories, "7-12").map((s) => s.id), ["b"]);
  assert.deepEqual(filterByAge(stories, "4-6").map((s) => s.id), ["a"]);
  assert.equal(filterByAge(stories, "all").length, 2);
});

test("availableAges only appears when >1 age range is present", () => {
  assert.deepEqual(availableAges(stories), ["all", "4-6", "7-12"]);
  assert.deepEqual(availableAges([stories[0]]), []); // single age → no age row
});

test("storyCardHTML includes title, cover, badges, id, and escapes html", () => {
  const html = storyCardHTML(stories[0]);
  assert.match(html, /a\.jpg/);
  assert.match(html, /data-id="a"/);
  assert.match(html, /🎬/);
  assert.match(storyCardHTML(stories[1]), /B &amp; &lt;b&gt;/);
});
