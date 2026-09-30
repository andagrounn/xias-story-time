export function playerMarkup(story) {
  const { primary, media } = story;
  if (primary === "video") {
    // cc_load_policy=0 keeps captions off by default; iv_load_policy=3 hides annotations.
    return `<iframe class="stage" src="https://www.youtube-nocookie.com/embed/${media.video}?autoplay=1&rel=0&cc_load_policy=0&iv_load_policy=3"
      title="${escapeAttr(story.title)}" allow="autoplay; fullscreen" allowfullscreen frameborder="0"></iframe>`;
  }
  if (primary === "audio") {
    return `<div class="audio-stage">
      <img class="audio-art" src="${safeUrl(story.cover)}" alt="" />
      <audio controls autoplay src="${safeUrl(media.audio)}"></audio>
    </div>`;
  }
  if (primary === "read" && media.pages && media.pages.length) {
    const pages = media.pages
      .map((p, i) => `<img class="page${i === 0 ? " on" : ""}" src="${safeUrl(p)}" alt="Page ${i + 1}" />`)
      .join("");
    // Optional narration: a toggle button + a hidden audio track (the mp3 keeps
    // playing across page turns; closing the player stops it).
    const narration = safeUrl(media.narration)
      ? `<button class="narrate" aria-pressed="false" aria-label="Play narration">🔊 Narrate</button>
         <audio class="narration" src="${safeUrl(media.narration)}" preload="none"></audio>`
      : "";
    return `<div class="reader" data-page="0" data-total="${media.pages.length}">
      <button class="nav prev" aria-label="Previous page">‹</button>
      <div class="pages">${pages}</div>
      <button class="nav next" aria-label="Next page">›</button>
      <span class="counter">1 / ${media.pages.length}</span>
      ${narration}
    </div>`;
  }
  const site = SOURCE_NAME[story.source] || "its home site";
  return `<div class="linkout">
    <img class="linkout-cover" src="${safeUrl(story.cover)}" alt="" onerror="this.remove()" />
    <p>This story opens on ${site}.</p>
    <a class="linkout-btn" href="${safeUrl(media.read)}" target="_blank" rel="noopener">Open the book 📖</a>
  </div>`;
}

const SOURCE_NAME = { storyberries: "Storyberries", storyweaver: "StoryWeaver" };

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

// Only allow http(s) URLs into an attribute, and escape quotes so a crafted
// value can't break out of the attribute (defense-in-depth for scraped data).
function safeUrl(u) {
  return /^https?:\/\//i.test(u || "") ? escapeAttr(u) : "";
}

export function closePlayer() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = "";
  document.removeEventListener("keydown", onKey);
}

function onKey(e) {
  const reader = document.querySelector("#overlay .reader");
  if (e.key === "Escape") return closePlayer();
  if (reader && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    turnPage(reader, e.key === "ArrowRight" ? 1 : -1);
  }
}

function turnPage(reader, dir) {
  const total = Number(reader.dataset.total);
  let page = Number(reader.dataset.page);
  page = Math.min(total - 1, Math.max(0, page + dir));
  reader.dataset.page = page;
  reader.querySelectorAll(".page").forEach((p, i) => p.classList.toggle("on", i === page));
  reader.querySelector(".counter").textContent = `${page + 1} / ${total}`;
}

export function openPlayer(story) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `
    <button class="overlay-close" aria-label="Close">✕</button>
    <div class="overlay-body">${playerMarkup(story)}</div>`;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  overlay.querySelector(".overlay-close").addEventListener("click", closePlayer);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePlayer();
  });
  const reader = overlay.querySelector(".reader");
  if (reader) {
    reader.querySelector(".next").addEventListener("click", () => turnPage(reader, 1));
    reader.querySelector(".prev").addEventListener("click", () => turnPage(reader, -1));
    wireNarration(reader);
  }
  document.addEventListener("keydown", onKey);
}

// Narration toggle: play/pause the mp3, reflecting state on the button.
function wireNarration(reader) {
  const btn = reader.querySelector(".narrate");
  const audio = reader.querySelector(".narration");
  if (!btn || !audio) return;
  const sync = () => {
    const on = !audio.paused;
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "⏸ Narrating" : "🔊 Narrate";
  };
  btn.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  audio.addEventListener("play", sync);
  audio.addEventListener("pause", sync);
  audio.addEventListener("ended", sync);
}
