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
