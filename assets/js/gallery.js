import { escapeHtml, getData, initials, parseVideo, safeUrl } from "./core.js";
import { initSite } from "./site.js";

const grid = document.querySelector("#video-grid");
const status = document.querySelector("#video-status");

const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`;
const closeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`;

let openPlayer = null;

function sortedProjects(projects) {
  return [...projects].sort(
    (a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      String(b.published || "").localeCompare(String(a.published || ""))
  );
}

function watchUrl(video) {
  if (video?.type === "youtube") return `https://www.youtube.com/watch?v=${video.id}`;
  if (video?.type === "vimeo") return `https://vimeo.com/${video.id}`;
  return "";
}

function cardMarkup(project, index) {
  const video = parseVideo(project.video);
  const poster = safeUrl(project.thumbnail);
  const details = `project.html?p=${encodeURIComponent(project.slug)}`;
  const external = watchUrl(video);

  const play = video
    ? `<button class="play-btn" type="button"
        ${video.type === "file" ? `data-file="${escapeHtml(video.src)}"` : `data-embed="${escapeHtml(video.embed)}"`}
        data-title="${escapeHtml(project.title)}"
        aria-label="Play ${escapeHtml(project.title)} video">${playIcon}</button>`
    : "";

  const tags = (project.tags || [])
    .slice(0, 3)
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join("");

  return `
    <article class="video-card">
      <div class="video-media${video ? " is-playable" : ""}">
        ${poster
          ? `<img src="${escapeHtml(poster.href)}" alt="" loading="${index < 2 ? "eager" : "lazy"}" decoding="async" data-initials="${escapeHtml(initials(project.title))}">`
          : `<span class="poster-fallback" aria-hidden="true">${escapeHtml(initials(project.title))}</span>`}
        ${play}
      </div>
      <div class="video-body">
        <h3><a href="${details}">${escapeHtml(project.title)}</a></h3>
        <p>${escapeHtml(project.tagline)}</p>
        ${tags ? `<ul class="video-tags">${tags}</ul>` : ""}
        <div class="video-actions">
          <a class="link-arrow" href="${details}">Project details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          ${external ? `<a class="link-muted" href="${escapeHtml(external)}" target="_blank" rel="noopener">Open on YouTube ↗</a>` : ""}
        </div>
      </div>
    </article>`;
}

function closePlayer({ restoreFocus = true } = {}) {
  if (!openPlayer) return;
  const { wrap, trigger } = openPlayer;
  openPlayer = null;
  wrap.remove();
  if (restoreFocus) trigger.focus();
}

function openVideo(button) {
  const media = button.closest(".video-media");
  if (!media) return;

  const isFile = Boolean(button.dataset.file);
  const source = safeUrl(isFile ? button.dataset.file : button.dataset.embed);
  if (!source) return;

  closePlayer({ restoreFocus: false });

  const wrap = document.createElement("div");
  wrap.className = "video-player-wrap";
  wrap.innerHTML = `<button class="player-close" type="button" aria-label="Close video">${closeIcon}</button>`;

  if (isFile) {
    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = source.href;
    wrap.appendChild(video);
  } else {
    const frame = document.createElement("iframe");
    frame.src = source.href;
    frame.title = `Video: ${button.dataset.title || "project"}`;
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    wrap.appendChild(frame);
  }

  media.appendChild(wrap);
  openPlayer = { wrap, trigger: button };
  wrap.querySelector(".player-close").focus();
}

function wire({ projects }) {
  if (status) status.remove();

  document.querySelector("#stat-plugins")?.replaceChildren(
    document.createTextNode(`${projects.length} plugin${projects.length === 1 ? "" : "s"}`)
  );

  grid.querySelectorAll(".video-media img").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.className = "poster-fallback";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = image.dataset.initials || "·";
      image.replaceWith(fallback);
    });
  });

  grid.addEventListener("click", (event) => {
    if (event.target.closest(".player-close")) {
      closePlayer();
      return;
    }

    const trigger = event.target.closest("[data-play], .play-btn");
    if (trigger) {
      event.preventDefault();
      openVideo(trigger);
      return;
    }

    const media = event.target.closest(".video-media.is-playable");
    if (media && !media.querySelector(".video-player-wrap")) {
      media.querySelector(".play-btn")?.click();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openPlayer) closePlayer();
  });
}

function showError(message) {
  status?.remove();
  grid.innerHTML = `
    <div class="empty" style="grid-column: 1 / -1">
      <p><strong>Could not load videos.</strong><br>${escapeHtml(message)}</p>
      <p class="hint">If you opened this file directly, serve it over HTTP instead: <code>npx serve .</code></p>
    </div>`;
}

async function boot() {
  initSite();

  try {
    const data = await getData();
    const projects = sortedProjects(data.projects || []);

    if (!projects.length) {
      status?.remove();
      grid.innerHTML = `
        <div class="empty" style="grid-column: 1 / -1">
          <p><strong>No videos yet.</strong></p>
          <p class="hint">Add a project in the admin editor to show it here.</p>
        </div>`;
      return;
    }

    grid.innerHTML = projects.map(cardMarkup).join("");
    wire({ projects });
  } catch (error) {
    showError(error.message);
  }
}

boot();
