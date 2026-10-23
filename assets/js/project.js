import {
  escapeHtml,
  formatDate,
  formatViews,
  getData,
  parseVideo,
  registerView,
  renderMarkdown,
  safeUrl,
} from "./core.js";
import { initSite } from "./site.js";

const main = document.querySelector("#detail");
const slug = new URLSearchParams(location.search).get("p");

const eyeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;
const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`;

function thumbnailMarkup(project, className = "") {
  if (!project.thumbnail) return "";
  return `<img class="${className}" src="${escapeHtml(project.thumbnail)}" alt="" loading="eager" decoding="async">`;
}

function mediaMarkup(project) {
  const video = parseVideo(project.video);

  if (video?.type === "youtube" || video?.type === "vimeo") {
    return `
      <div class="detail-media">
        <button class="video-facade" type="button"
          data-embed="${escapeHtml(video.embed)}"
          data-title="${escapeHtml(project.title)}"
          aria-label="Play demo video for ${escapeHtml(project.title)}">
          ${thumbnailMarkup(project)}
          <span class="play">${playIcon}</span>
          <span class="facade-label">Watch demo</span>
        </button>
      </div>`;
  }

  if (video?.type === "file") {
    return `
      <div class="detail-media">
        <button class="video-facade" type="button"
          data-file="${escapeHtml(video.src)}"
          data-poster="${escapeHtml(project.thumbnail || "")}"
          aria-label="Play demo video for ${escapeHtml(project.title)}">
          ${thumbnailMarkup(project)}
          <span class="play">${playIcon}</span>
          <span class="facade-label">Watch demo</span>
        </button>
      </div>`;
  }

  if (project.thumbnail) {
    return `<div class="detail-media">${thumbnailMarkup(project, "video-still")}</div>`;
  }

  return "";
}

function commentsMarkup(site) {
  const config = site.giscus || {};
  if (site.features?.comments === false || !config.repoId || !config.categoryId) return "";

  return `
    <section class="comments" id="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">Comments</h2>
      <p class="comments-hint">Join the discussion on GitHub. You'll need a GitHub account to comment.</p>
      <div class="giscus-host" id="giscus-host"></div>
    </section>`;
}

function render(project, site) {
  document.title = `${project.title} — ${site.name || "Portfolio"}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", project.tagline || "");

  const source = safeUrl(project.github);
  const download = safeUrl(project.download);
  const tags = (project.tags || [])
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join("");
  const date = formatDate(project.published);

  const viewsEnabled = site.features?.views !== false;
  const baseViews = Number(project.baseViews) || 0;
  const views = viewsEnabled
    ? `<span class="views" id="view-count" ${baseViews > 0 ? "" : "hidden"}>${eyeIcon}<span>${formatViews(baseViews)}</span></span>`
    : "";

  const metaParts = [];
  if (tags) metaParts.push(`<ul class="tags">${tags}</ul>`);
  if (date) metaParts.push(`<span>${escapeHtml(date)}</span>`);
  if (views) metaParts.push(views);
  const meta = metaParts.length
    ? `<div class="meta-row">${metaParts.join('<span class="meta-dot" aria-hidden="true">·</span>')}</div>`
    : "";

  const actions = [];
  if (download) {
    actions.push(
      `<a class="btn btn-primary" href="${escapeHtml(download.href)}" target="_blank" rel="noopener">Download latest</a>`
    );
  }
  if (source) {
    actions.push(
      `<a class="btn btn-ghost" href="${escapeHtml(source.href)}" target="_blank" rel="noopener">View source</a>`
    );
  }

  main.innerHTML = `
    <a class="back" href="index.html#work">← All work</a>
    ${mediaMarkup(project)}
    <header class="detail-head">
      <h1>${escapeHtml(project.title)}</h1>
      <p class="detail-tagline">${escapeHtml(project.tagline)}</p>
      ${meta}
      ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
    </header>
    ${project.body ? `<article class="prose">${renderMarkdown(project.body)}</article>` : ""}
    ${commentsMarkup(site)}`;

  if (viewsEnabled) countView(project, site);
  if (site.giscus?.repoId && site.giscus?.categoryId) loadComments(project, site);
}

async function countView(project, site) {
  const element = document.querySelector("#view-count");
  if (!element) return;

  const base = Number(project.baseViews) || 0;
  const live = await registerView(site, project.slug);
  const total = base + (live || 0);

  if (total > 0) {
    element.hidden = false;
    const label = element.querySelector("span");
    if (label) label.textContent = formatViews(total);
  }
}

function loadComments(project, site) {
  const host = document.querySelector("#giscus-host");
  if (!host) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      injectGiscus(host, site.giscus, project.slug);
    },
    { rootMargin: "400px" }
  );

  observer.observe(host);
}

function injectGiscus(host, config, term) {
  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";

  const attributes = {
    "data-repo": config.repo,
    "data-repo-id": config.repoId,
    "data-category": config.category || "Announcements",
    "data-category-id": config.categoryId,
    "data-mapping": "specific",
    "data-term": term,
    "data-strict": "1",
    "data-reactions-enabled": "1",
    "data-emit-metadata": "0",
    "data-input-position": "top",
    "data-theme": document.documentElement.dataset.theme || "light",
    "data-lang": "en",
    "data-loading": "lazy",
  };

  Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
  host.appendChild(script);
}

function showMessage(title, message) {
  document.title = `${title} — Portfolio`;
  main.innerHTML = `
    <div class="notfound">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="index.html#work">Back to all work</a>
    </div>`;
}

main?.addEventListener("click", (event) => {
  const facade = event.target.closest(".video-facade");
  if (!facade) return;

  if (facade.dataset.file) {
    const source = safeUrl(facade.dataset.file);
    if (!source) return;

    const video = document.createElement("video");
    video.className = "video-player";
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = source.href;
    if (facade.dataset.poster) video.poster = facade.dataset.poster;
    facade.replaceWith(video);
    video.play().catch(() => {
      /* autoplay can be blocked; native controls remain */
    });
    return;
  }

  const embed = safeUrl(facade.dataset.embed);
  if (!embed) return;

  const iframe = document.createElement("iframe");
  iframe.src = embed.href;
  iframe.title = `Demo video: ${facade.dataset.title || "project"}`;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  facade.replaceWith(iframe);
});

document.addEventListener(
  "error",
  (event) => {
    if (event.target instanceof HTMLImageElement) event.target.remove();
  },
  true
);

document.addEventListener("themechange", (event) => {
  const frame = document.querySelector("iframe.giscus-frame");
  frame?.contentWindow?.postMessage(
    { giscus: { type: "setTheme", theme: event.detail.theme } },
    "https://giscus.app"
  );
});

async function boot() {
  initSite();

  if (!slug) {
    showMessage("No project selected", "Pick a project from the gallery to see its details.");
    return;
  }

  try {
    const data = await getData();
    const site = data.site || {};
    const project = (data.projects || []).find((item) => item.slug === slug);

    if (!project) {
      showMessage("Project not found", "That project doesn't exist — it may have been renamed.");
      return;
    }

    render(project, site);
  } catch (error) {
    showMessage("Could not load project", error.message);
  }
}

boot();
