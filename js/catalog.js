export const MEDIA_PRIORITY = ["video", "audio", "read"];

// A story "has" a capability when it can actually play it in-app:
// video → a YouTube id, audio → a narration url, read → page images.
// media.read is only a fallback link, so it does NOT grant the read badge.
export function hasMedia(media, type) {
  if (!media) return false;
  if (type === "read") return Array.isArray(media.pages) && media.pages.length > 0;
  return Boolean(media[type]);
}

// A "book" is an external library entry: it opens on its source site (a read
// link) but has nothing that plays in-app (no video, no audio, no page images).
export function isBook(media) {
  if (!media) return false;
  return Boolean(media.read) && !hasMedia(media, "video") &&
    !hasMedia(media, "audio") && !hasMedia(media, "read");
}

export function deriveBadges(media) {
  const badges = MEDIA_PRIORITY.filter((k) => hasMedia(media, k));
  if (isBook(media)) badges.push("book");
  return badges;
}

export function pickPrimary(media) {
  return MEDIA_PRIORITY.find((k) => hasMedia(media, k)) ?? null;
}

export function normalizeStory(raw) {
  return { ...raw, badges: deriveBadges(raw.media), primary: pickPrimary(raw.media) };
}

export async function loadCatalog(url = "data/stories.json", fetchFn = fetch) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const data = await res.json();
  return data.map(normalizeStory);
}
