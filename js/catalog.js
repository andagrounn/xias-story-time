export const MEDIA_PRIORITY = ["video", "audio", "read"];

export function deriveBadges(media) {
  return MEDIA_PRIORITY.filter((k) => media && media[k]);
}

export function pickPrimary(media) {
  return MEDIA_PRIORITY.find((k) => media && media[k]) ?? null;
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
