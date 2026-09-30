import { loadCatalog } from "./catalog.js";

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
  return `
    <button class="card" data-id="${story.id}" aria-label="Play ${escapeHtml(story.title)}">
      <img class="card-cover" src="${story.cover}" alt="" loading="lazy"
           onerror="this.classList.add('missing')" />
      <span class="card-title">${escapeHtml(story.title)}</span>
      <span class="card-badges">${badges}</span>
    </button>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function initApp(root, stories, onOpen) {
  const grid = root.querySelector("#grid");
  const chipBar = root.querySelector("#chips");
  const ageBar = root.querySelector("#age-chips");
  const chips = availableChips(stories);
  const ages = availableAges(stories);
  let active = "all";
  let activeAge = "all";

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
    onOpen(stories.find((s) => s.id === card.dataset.id));
  });

  render();
}

// Bootstrap in the browser only (Node tests import the pure functions above).
if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  loadCatalog()
    .then((stories) => {
      import("./player.js?v=5").then(({ openPlayer }) => initApp(root, stories, openPlayer));
    })
    .catch(() => {
      root.querySelector("#grid").innerHTML =
        `<p class="empty">Let's get online first 🌙</p>`;
    });
}
