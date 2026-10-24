const DATA_URL = "data/projects.json";
const COUNTER_BASE = "https://abacus.jasoncameron.dev";
const VIEW_TTL = 10 * 60 * 1000;

let dataPromise = null;

/**
 * Load projects.json. Cached for the lifetime of the page; pass fresh: true
 * after a server change (admin reload).
 */
export function getData({ fresh = false } = {}) {
  if (!dataPromise || fresh) {
    // GitHub Pages caches JSON for 10 minutes; a unique query gets the latest commit.
    dataPromise = fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${res.status})`);
      return res.json();
    });
  }
  return dataPromise;
}

export function escapeHtml(value) {
  const str = value == null ? "" : String(value);
  return str.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** http(s) URL only — blocks javascript: and other schemes from JSON. */
export function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value), document.baseURI);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function initials(value = "") {
  const letters = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "·";
}

export function formatViews(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1000) return `${Math.round(n)} view${Math.round(n) === 1 ? "" : "s"}`;
  const units = [
    [1e9, "b"],
    [1e6, "m"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const short = Math.round((n / size) * 10) / 10;
      return `${short}${suffix} views`;
    }
  }
  return `${n} views`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

/** Recognise YouTube, Vimeo and direct video URLs. */
export function parseVideo(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const href = url.href;

  const youtube = href.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (youtube) {
    return {
      type: "youtube",
      id: youtube[1],
      embed: `https://www.youtube-nocookie.com/embed/${youtube[1]}?autoplay=1&rel=0`,
    };
  }

  const vimeo = href.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return {
      type: "vimeo",
      id: vimeo[1],
      embed: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`,
    };
  }

  if (/\.(mp4|webm|ogv|ogg)(?:[?#]|$)/i.test(href)) {
    return { type: "file", src: href };
  }

  return null;
}

export function renderMarkdown(markdown = "") {
  if (typeof window !== "undefined" && window.marked?.parse) {
    try {
      return window.marked.parse(String(markdown), { gfm: true, breaks: false });
    } catch {
      // fall through to plain text
    }
  }
  return String(markdown)
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function validateProject(project, others = []) {
  const errors = {};
  const p = project || {};

  if (!String(p.title || "").trim()) errors.title = "Title is required.";
  if (!String(p.tagline || "").trim()) errors.tagline = "Tagline is required.";

  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(p.slug || "")) {
    errors.slug = "Use 2–64 lowercase letters, numbers or dashes.";
  } else if (others.some((item) => item.slug === p.slug)) {
    errors.slug = "That slug is already used by another project.";
  }

  if (!Array.isArray(p.tags) || p.tags.length === 0) {
    errors.tags = "Add at least one tag.";
  }

  if (p.video && !parseVideo(p.video)) {
    errors.video = "Use a YouTube, Vimeo or .mp4/.webm URL.";
  }

  for (const key of ["github", "download"]) {
    if (p[key] && !safeUrl(p[key])) errors[key] = "Must be an http(s) URL.";
  }

  if (p.thumbnail && !/^(https?:\/\/|\/|\.{1,2}\/|assets\/)/i.test(p.thumbnail)) {
    errors.thumbnail = "Use an https URL or a path like assets/thumbs/name.webp.";
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Views — free Abacus counter, best effort. Fails silently.                   */
/* -------------------------------------------------------------------------- */

export function counterNamespace(site) {
  const raw = site?.counterNamespace || (typeof location !== "undefined" ? location.hostname : "") || "site";
  return String(raw).replace(/[^A-Za-z0-9.-]/g, "-");
}

function isLocal() {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
}

function cacheRead(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw);
    if (!Number.isFinite(value) || Date.now() - at > VIEW_TTL) return null;
    return value;
  } catch {
    return null;
  }
}

function cacheWrite(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export async function getViewCount(site, slug) {
  const namespace = counterNamespace(site);
  const cacheKey = `pv:${namespace}:${slug}`;
  const cached = cacheRead(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(
      `${COUNTER_BASE}/get/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const value = Number(data?.value);
    if (!Number.isFinite(value)) return null;
    cacheWrite(cacheKey, value);
    return value;
  } catch {
    return null;
  }
}

export async function registerView(site, slug) {
  const namespace = counterNamespace(site);
  if (isLocal()) return getViewCount(site, slug);

  const sessionKey = `hit:${namespace}:${slug}`;
  let alreadyHit = false;
  try {
    alreadyHit = sessionStorage.getItem(sessionKey) === "1";
  } catch {
    /* storage unavailable */
  }

  if (!alreadyHit) {
    try {
      const res = await fetch(
        `${COUNTER_BASE}/hit/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        const value = Number(data?.value);
        if (Number.isFinite(value)) {
          cacheWrite(`pv:${namespace}:${slug}`, value);
          try {
            sessionStorage.setItem(sessionKey, "1");
          } catch {
            /* storage unavailable */
          }
          return value;
        }
      }
    } catch {
      /* counter offline — keep the base count */
    }
  }

  return getViewCount(site, slug);
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

export function initTheme() {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-theme-toggle]");

  const sync = () => {
    const dark = root.dataset.theme === "dark";
    buttons.forEach((button) => {
      button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("title", dark ? "Switch to light theme" : "Switch to dark theme");
    });
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", dark ? "#0d0e10" : "#f7f9fa");
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* storage unavailable */
      }
      sync();
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    });
  });

  sync();
}
