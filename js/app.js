import { loadCatalog } from "./catalog.js";

export const BADGE_ICON = { video: "🎬", audio: "🔊", read: "📖" };
const CHIP_LABEL = { all: "All", video: "🎬 Video", audio: "🔊 Audio", read: "📖 Read" };

export function filterStories(stories, type) {
  if (type === "all") return stories;
  return stories.filter((s) => s.badges.includes(type));
}

export function availableChips(stories) {
  const chips = ["all"];
  for (const type of ["video", "audio", "read"]) {
    if (stories.some((s) => s.badges.includes(type))) chips.push(type);
  }
  return chips;
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
  const chips = availableChips(stories);
  let active = "all";

  const render = () => {
    const shown = filterStories(stories, active);
    grid.innerHTML = shown.length
      ? shown.map(storyCardHTML).join("")
      : `<p class="empty">No stories here yet 🌙</p>`;
  };

  chipBar.innerHTML = chips
    .map(
      (c) =>
        `<button class="chip${c === active ? " on" : ""}" data-type="${c}">${CHIP_LABEL[c]}</button>`
    )
    .join("");

  chipBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    active = chip.dataset.type;
    chipBar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
    render();
  });

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
      import("./player.js").then(({ openPlayer }) => initApp(root, stories, openPlayer));
    })
    .catch(() => {
      root.querySelector("#grid").innerHTML =
        `<p class="empty">Let's get online first 🌙</p>`;
    });
}
