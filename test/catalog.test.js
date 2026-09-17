import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBadges, pickPrimary, normalizeStory, loadCatalog } from "../js/catalog.js";

test("deriveBadges reflects real capabilities (read needs pages, not just a link)", () => {
  assert.deepEqual(deriveBadges({ video: "abc", read: "u", pages: ["p1"] }), ["video", "read"]);
  assert.deepEqual(deriveBadges({ read: "u", pages: [] }), []); // link only, no pages
  assert.deepEqual(deriveBadges({ audio: "a", pages: ["p1"] }), ["audio", "read"]);
  assert.deepEqual(deriveBadges({}), []);
});

test("pickPrimary picks richest playable capability", () => {
  assert.equal(pickPrimary({ video: "abc", audio: "a", pages: ["p1"] }), "video");
  assert.equal(pickPrimary({ audio: "a", pages: ["p1"] }), "audio");
  assert.equal(pickPrimary({ pages: ["p1"] }), "read");
  assert.equal(pickPrimary({ read: "u", pages: [] }), null); // link only
  assert.equal(pickPrimary({}), null);
});

test("normalizeStory adds badges and primary", () => {
  const s = normalizeStory({ id: "x", title: "X", media: { read: "u", pages: ["p1", "p2"] } });
  assert.deepEqual(s.badges, ["read"]);
  assert.equal(s.primary, "read");
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
