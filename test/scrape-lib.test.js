import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeTitle,
  parseListing,
  parseStoryberriesSearch,
  matchCover,
  mergeSources,
  parseStoryPages,
  parseStoryWeaver,
  pickCover,
  parseSearchResults,
  extractSearchPage,
  cleanVideoTitle,
  parseAgeFromTitle,
  ytThumb,
  titleCoverage,
  bestVideoMatch,
} from "../scripts/scrape-lib.js";

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

test("mergeSources carries source and level through", () => {
  const out = mergeSources([
    {
      card: { title: "The Red Raincoat", url: "sw-url", cover: "c.jpg", source: "storyweaver", level: "1" },
      media: { read: "sw-url" },
    },
  ]);
  assert.equal(out[0].source, "storyweaver");
  assert.equal(out[0].level, "1");
  assert.equal(out.find((r) => r.title === "The Red Raincoat").media.read, "sw-url");
});

test("pickCover chooses a mid/large crop and tolerates missing sizes", () => {
  const cover = {
    sizes: [
      { width: 100, url: "s1" },
      { width: 200, url: "s2" },
      { width: 300, url: "s3" },
      { width: 400, url: "s4" },
    ],
  };
  assert.equal(pickCover(cover), "s3");
  assert.equal(pickCover({ sizes: [] }), null);
  assert.equal(pickCover(undefined), null);
});

test("parseStoryWeaver builds library cards and drops incomplete rows", () => {
  const json = {
    data: [
      {
        title: "The Red Raincoat",
        slug: "369-the-red-raincoat",
        level: "1",
        coverImage: { sizes: [{ width: 300, url: "cover.jpg" }] },
      },
      { title: "No Cover", slug: "1-no-cover" }, // dropped: no cover
      { title: "No Slug", coverImage: { sizes: [{ width: 300, url: "x.jpg" }] } }, // dropped: no url
    ],
  };
  const cards = parseStoryWeaver(json);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0], {
    title: "The Red Raincoat",
    url: "https://storyweaver.org.in/en/stories/369-the-red-raincoat?mode=read",
    cover: "cover.jpg",
    level: "1",
    source: "storyweaver",
  });
  assert.deepEqual(parseStoryWeaver({}), []);
});

test("parseSearchResults pulls video id, title, and channel from ytInitialData", () => {
  const data = {
    contents: {
      items: [
        {
          videoRenderer: {
            videoId: "abc12345678",
            title: { runs: [{ text: "THE THREE BILLY GOATS GRUFF | Storyberries" }] },
            ownerText: { runs: [{ navigationEndpoint: { browseEndpoint: { browseId: "UCQoz7oLrUVZlC0hsXdyA7oA" } } }] },
          },
        },
      ],
    },
  };
  const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
  const out = parseSearchResults(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "abc12345678");
  assert.equal(out[0].channelId, "UCQoz7oLrUVZlC0hsXdyA7oA");
  assert.match(out[0].title, /BILLY GOATS/);
  assert.deepEqual(parseSearchResults("<html>no data</html>"), []);
});

test("parseStoryberriesSearch reads title + cover from search-result articles", () => {
  const html = `<article>
      <a href="https://www.storyberries.com/the-forgetful-elephant/"><img class="wp-post-image" src="https://s/elephant.jpg" /></a>
      <h2 class="entry-title">The Forgetful Elephant</h2>
    </article>
    <article>
      <img class="wp-post-image" src="data:image/svg+xml,placeholder" data-lazy-src="https://s/sunshine.jpg" />
      <h2 class="entry-title">I Love Sunshine</h2>
    </article>`;
  const cards = parseStoryberriesSearch(html);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].title, "The Forgetful Elephant");
  assert.equal(cards[0].cover, "https://s/elephant.jpg");
  assert.equal(cards[1].cover, "https://s/sunshine.jpg"); // prefers data-lazy-src over data: placeholder
});

test("matchCover picks exact title, then strong coverage, else null", () => {
  const cards = [
    { title: "The Forgetful Elephant", cover: "elephant.jpg" },
    { title: "I Love Sunshine (a poem)", cover: "sunshine.jpg" },
  ];
  assert.equal(matchCover("The Forgetful Elephant", cards), "elephant.jpg");
  assert.equal(matchCover("I Love Sunshine", cards), "sunshine.jpg"); // coverage match
  assert.equal(matchCover("Totally Different Story", cards), null);
  assert.equal(matchCover("x", []), null);
});

test("cleanVideoTitle strips marketing cruft and title-cases shouty names", () => {
  assert.equal(
    cleanVideoTitle("THE FORGETFUL ELEPHANT 🍓 Read along animated picture book with English subtitles"),
    "The Forgetful Elephant"
  );
  assert.equal(cleanVideoTitle("I LOVE SUNSHINE #nature | Read along animated picture book"), "I Love Sunshine");
  assert.equal(cleanVideoTitle("Friendship Collection #1 | Age 4-6 | 60 minutes | Animated"), "Friendship Collection #1");
  assert.equal(cleanVideoTitle("LARGO DOESN'T KNOW 🍓 Read along"), "Largo Doesn't Know");
  assert.equal(cleanVideoTitle("The Window Seat"), "The Window Seat"); // already clean
});

test("parseAgeFromTitle reads an age hint or returns null", () => {
  assert.equal(parseAgeFromTitle("Something | Age 7-12 | 60 minutes"), "7-12");
  assert.equal(parseAgeFromTitle("Something | Age 4-6"), "4-6");
  assert.equal(parseAgeFromTitle("No age here"), null);
});

test("ytThumb builds a stable YouTube thumbnail url", () => {
  assert.equal(ytThumb("abc12345678"), "https://i.ytimg.com/vi/abc12345678/hqdefault.jpg");
});

test("extractSearchPage returns videos and the next continuation token", () => {
  const data = {
    contents: [
      { videoRenderer: { videoId: "vid00000001", title: { runs: [{ text: "One" }] }, ownerText: { runs: [{ navigationEndpoint: { browseEndpoint: { browseId: "UCQoz7oLrUVZlC0hsXdyA7oA" } } }] } } },
      { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "NEXT_TOKEN" } } } },
    ],
  };
  const { videos, continuation } = extractSearchPage(data);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].id, "vid00000001");
  assert.equal(videos[0].channelId, "UCQoz7oLrUVZlC0hsXdyA7oA");
  assert.equal(continuation, "NEXT_TOKEN");
});

test("titleCoverage measures how well a video title covers the story title", () => {
  assert.equal(titleCoverage("The Three Billy Goats Gruff", "THE THREE BILLY GOATS GRUFF | Kids Read along"), 1);
  assert.ok(titleCoverage("Granny: A Motion Poem", "Granny - a poem for children") >= 0.5);
  assert.equal(titleCoverage("Ruby", "A totally different cartoon"), 0);
});

test("bestVideoMatch only trusts vetted channels with a strong title match", () => {
  const vetted = new Set(["UCQoz7oLrUVZlC0hsXdyA7oA"]);
  const results = [
    { id: "good0000001", title: "THE THREE BILLY GOATS GRUFF | Storyberries", channelId: "UCQoz7oLrUVZlC0hsXdyA7oA" },
    { id: "wrong000001", title: "The Three Billy Goats Gruff", channelId: "UCsomeRandomChannel00000" },
    { id: "weak0000001", title: "Goats on a farm", channelId: "UCQoz7oLrUVZlC0hsXdyA7oA" },
  ];
  assert.equal(bestVideoMatch("The Three Billy Goats Gruff", results, vetted), "good0000001");
  // No vetted, strong match → rejected (unsafe source).
  assert.equal(bestVideoMatch("The Three Billy Goats Gruff", [results[1]], vetted), null);
  // Vetted but weak title → rejected (wrong story).
  assert.equal(bestVideoMatch("The Three Billy Goats Gruff", [results[2]], vetted), null);
  assert.equal(bestVideoMatch("Anything", [], vetted), null);
});
