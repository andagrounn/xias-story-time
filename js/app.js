import { loadCatalog } from "./catalog.js?v=6";

export const BADGE_ICON = { video: "🎬", audio: "🔊", read: "📖", book: "📚" };
const CHIP_LABEL = { all: "All", video: "🎬 Video", audio: "🔊 Audio", read: "📖 Read", book: "📚 Library" };
// Age filter is a second, independent dimension. Order controls chip order.
const AGE_ORDER = ["4-6", "7-12"];
const AGE_LABEL = { all: "All ages", "4-6": "🧸 Ages 4–6", "7-12": "🎒 Ages 7–12" };

export function filterStories(stories, type) {
  if (type === "all") return stories;
  return stories.filter((s) => s.badges.includes(type));
}

export function filterByAge(stories, age) {
  if (age === "all") return stories;
  return stories.filter((s) => s.ageRange === age);
}

export function availableChips(stories) {
  const chips = ["all"];
  for (const type of ["video", "audio", "read", "book"]) {
    if (stories.some((s) => s.badges.includes(type))) chips.push(type);
  }
  return chips;
}

// Only offer the age row when more than one age range is actually present.
export function availableAges(stories) {
  const present = AGE_ORDER.filter((a) => stories.some((s) => s.ageRange === a));
  return present.length > 1 ? ["all", ...present] : [];
}

export function storyCardHTML(story) {
  const badges = story.badges.map((b) => BADGE_ICON[b]).join(" ");
  const tick = story.watched
    ? `<span class="card-tick" aria-label="Watched">✓</span>`
    : "";
  return `
    <button class="card${story.watched ? " watched" : ""}" data-id="${story.id}" aria-label="Play ${escapeHtml(story.title)}">
      <img class="card-cover" src="${story.cover}" alt="" loading="lazy"
           onerror="this.classList.add('missing')" />
      ${tick}
      <span class="card-title">${escapeHtml(story.title)}</span>
      <span class="card-badges">${badges}</span>
    </button>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Fisher-Yates in-place shuffle (returns the array for convenience).
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Watched stories persist across sessions in localStorage (just a set of ids).
const WATCHED_KEY = "xia-watched";
export function loadWatched() {
  return loadIds(WATCHED_KEY);
}
export function saveWatched(ids) {
  saveIds(WATCHED_KEY, ids);
}

// "Known" = story ids this device has seen before. Anything not in it is newly
// added to the catalog, so it floats to the top on the next load.
const KNOWN_KEY = "xia-known";
export function loadKnown() {
  return loadIds(KNOWN_KEY);
}
export function saveKnown(ids) {
  saveIds(KNOWN_KEY, ids);
}

function loadIds(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}
function saveIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* no storage (private mode) — just won't persist */
  }
}

// Load order: newly-added stories first, then everything else — each group
// shuffled, so the wall is fresh on every refresh but new content leads.
export function arrangeStories(stories, known) {
  const recent = stories.filter((s) => !known.has(s.id));
  const rest = stories.filter((s) => known.has(s.id));
  return [...shuffle(recent), ...shuffle(rest)];
}

export function initApp(root, stories, onOpen) {
  const grid = root.querySelector("#grid");
  const chipBar = root.querySelector("#chips");
  const ageBar = root.querySelector("#age-chips");
  const chips = availableChips(stories);
  const ages = availableAges(stories);
  let active = "all";
  let activeAge = "all";

  // Order for this load: new stories up top, the rest shuffled. Then remember
  // every current id so they're no longer "new" next time.
  const known = loadKnown();
  stories.splice(0, stories.length, ...arrangeStories(stories, known));
  saveKnown(stories.map((s) => s.id));

  const watched = loadWatched();
  stories.forEach((s) => (s.watched = watched.has(s.id)));

  const render = () => {
    const shown = filterByAge(filterStories(stories, active), activeAge);
    grid.innerHTML = shown.length
      ? shown.map(storyCardHTML).join("")
      : `<p class="empty">No stories here yet 🌙</p>`;
  };

  const renderBar = (bar, keys, labels, getActive) =>
    (bar.innerHTML = keys
      .map(
        (c) =>
          `<button class="chip${c === getActive() ? " on" : ""}" data-key="${c}">${labels[c]}</button>`
      )
      .join(""));

  const wireBar = (bar, setActive) =>
    bar.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      setActive(chip.dataset.key);
      bar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
      render();
    });

  renderBar(chipBar, chips, CHIP_LABEL, () => active);
  wireBar(chipBar, (k) => (active = k));

  if (ageBar && ages.length) {
    renderBar(ageBar, ages, AGE_LABEL, () => activeAge);
    wireBar(ageBar, (k) => (activeAge = k));
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const story = stories.find((s) => s.id === card.dataset.id);
    if (!story) return;
    onOpen(story);
    // Mark watched (bright yellow tick); the wall reshuffles on next refresh.
    story.watched = true;
    watched.add(story.id);
    saveWatched(watched);
    render();
  });

  render();
}

// Bootstrap in the browser only (Node tests import the pure functions above).
if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  loadCatalog()
    .then((stories) => {
      import("./player.js?v=6").then(({ openPlayer }) => initApp(root, stories, openPlayer));
    })
    .catch(() => {
      root.querySelector("#grid").innerHTML =
        `<p class="empty">Let's get online first 🌙</p>`;
    });
}
