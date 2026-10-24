import { escapeHtml, formatViews, getData, getViewCount, initials, safeUrl } from "./core.js";
import { initSite } from "./site.js";

const state = {
  site: {},
  projects: [],
  query: "",
  tag: "all",
};

const grid = document.querySelector("#grid");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");
const chips = document.querySelector("#chips");
const search = document.querySelector("#q");
const frameImg = document.querySelector("#frame-img");
const frameMono = document.querySelector("#frame-mono");

const eyeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;

let searchTimer = null;
let viewObserver = null;
let frameObserver = null;

function sortedProjects(projects) {
  return [...projects].sort(
    (a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      String(b.published || "").localeCompare(String(a.published || ""))
  );
}

function nameMarkup(project, index) {
  const tags = (project.tags || [])
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join("");

  const viewsEnabled = state.site.features?.views !== false;
  const baseViews = Number(project.baseViews) || 0;
  const views = viewsEnabled
    ? `<span class="views" data-views="${escapeHtml(project.slug)}" ${baseViews > 0 ? "" : "hidden"}>${eyeIcon}<span>${formatViews(baseViews)}</span></span>`
    : "";

  return `
    <article class="name-entry" data-slug="${escapeHtml(project.slug)}" style="animation-delay:${index * 60}ms">
      <h3 class="name-title"><a href="project.html?p=${encodeURIComponent(project.slug)}">${escapeHtml(project.title)}</a></h3>
      <div class="name-meta">
        ${views}
        <ul class="tags">${tags}</ul>
      </div>
      <p class="name-line">${escapeHtml(project.tagline)}</p>
    </article>`;
}

function renderChips() {
  const tags = [...new Set(state.projects.flatMap((project) => project.tags || []))].sort((a, b) =>
    a.localeCompare(b)
  );

  chips.innerHTML = [
    `<button class="chip" type="button" data-tag="all" aria-pressed="${state.tag === "all"}">All</button>`,
    ...tags.map(
      (tag) =>
        `<button class="chip" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="${state.tag === tag}">${escapeHtml(tag)}</button>`
    ),
  ].join("");
}

function syncUrl() {
  const url = new URL(location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.tag !== "all") url.searchParams.set("tag", state.tag);
  else url.searchParams.delete("tag");
  history.replaceState(null, "", url);
}

function filteredProjects() {
  const query = state.query.trim().toLowerCase();
  return state.projects.filter((project) => {
    if (state.tag !== "all" && !(project.tags || []).includes(state.tag)) return false;
    if (!query) return true;
    return [project.title, project.tagline, ...(project.tags || [])]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

async function loadCardViews(element, project) {
  if (!project) return;
  const live = await getViewCount(state.site, project.slug);
  const total = (Number(project.baseViews) || 0) + (live || 0);
  if (total <= 0) return;
  const label = element.querySelector("span");
  if (!label) return;
  label.textContent = formatViews(total);
  element.hidden = false;
}

function observeViews() {
  if (state.site.features?.views === false) return;
  viewObserver?.disconnect();

  const bySlug = new Map(state.projects.map((project) => [project.slug, project]));
  viewObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        viewObserver.unobserve(entry.target);
        loadCardViews(entry.target, bySlug.get(entry.target.dataset.views));
      }
    },
    { rootMargin: "240px" }
  );

  grid.querySelectorAll("[data-views]").forEach((element) => viewObserver.observe(element));
}

/* The held square: swap its picture as each name crosses the viewport centre. */
function setFrame(project) {
  if (!project) return;
  const url = project.thumbnail ? safeUrl(project.thumbnail) : null;
  if (url) {
    frameImg.hidden = true;
    frameImg.src = url.href;
    frameImg.hidden = false;
    frameMono.hidden = true;
  } else {
    frameImg.hidden = true;
    frameImg.removeAttribute("src");
    frameMono.textContent = initials(project.title);
    frameMono.hidden = false;
  }
}

function observeFrame() {
  frameObserver?.disconnect();
  const bySlug = new Map(state.projects.map((project) => [project.slug, project]));
  frameObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setFrame(bySlug.get(entry.target.dataset.slug));
      }
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  grid.querySelectorAll(".name-entry").forEach((element) => frameObserver.observe(element));
}

function render() {
  const projects = filteredProjects();
  grid.innerHTML = projects.map(nameMarkup).join("");
  count.textContent = `${projects.length} project${projects.length === 1 ? "" : "s"}`;
  empty.hidden = projects.length !== 0;

  chips.querySelectorAll(".chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.tag === state.tag));
  });

  setFrame(projects[0]);
  observeFrame();
  observeViews();
}

function showLoadError(message) {
  grid.innerHTML = `
    <div class="empty">
      <p><strong>Could not load projects.</strong><br>${escapeHtml(message)}</p>
      <p class="hint">If you opened this file directly, serve it over HTTP instead: <code>npx serve .</code></p>
    </div>`;
  count.textContent = "";
}

function wire() {
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = search.value;
      render();
      syncUrl();
    }, 120);
  });

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      search.value = "";
      state.query = "";
      render();
      syncUrl();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    ) {
      return;
    }
    event.preventDefault();
    search.focus();
  });

  chips.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.tag = chip.dataset.tag;
    render();
    syncUrl();
  });

  document.querySelector("#clear-filters").addEventListener("click", () => {
    state.query = "";
    state.tag = "all";
    search.value = "";
    render();
    syncUrl();
    search.focus();
  });

  frameImg.addEventListener("error", () => {
    frameImg.hidden = true;
    frameImg.removeAttribute("src");
    frameMono.hidden = false;
  });
}

async function boot() {
  initSite();

  const params = new URLSearchParams(location.search);
  state.query = (params.get("q") || "").trim();
  state.tag = params.get("tag") || "all";
  search.value = state.query;

  wire();

  try {
    const data = await getData();
    state.site = data.site || {};
    state.projects = sortedProjects(data.projects || []);

    if (state.tag !== "all" && !state.projects.some((project) => (project.tags || []).includes(state.tag))) {
      state.tag = "all";
    }

    renderChips();
    render();
  } catch (error) {
    showLoadError(error.message);
  }
}

boot();
