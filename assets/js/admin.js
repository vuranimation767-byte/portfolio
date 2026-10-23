import {
  escapeHtml,
  getData,
  initTheme,
  parseVideo,
  renderMarkdown,
  safeUrl,
  slugify,
  validateProject,
} from "./core.js";

/* Cosmetic gate only — the real lock is your GitHub account. Default: "minecraft" */
const ADMIN_HASH = "9970626666560a32465d4ce10d28f3233365af833e15eed59884d9477862c379";
const DRAFT_KEY = "portfolio-draft-v1";
const PUBLISH_KEY = "portfolio-publish-v1";
const UNLOCK_KEY = "portfolio-admin-unlocked";

const $ = (selector) => document.querySelector(selector);

const gate = $("#gate");
const gateCard = $(".gate-card");
const gateForm = $("#gate-form");
const gatePass = $("#gate-pass");
const gateError = $("#gate-error");
const app = $("#admin-main");
const list = $("#project-list");
const projectCount = $("#project-count");
const form = $("#project-form");
const emptyEditor = $("#editor-empty");
const formTitle = $("#form-title");
const deleteBtn = $("#delete-btn");
const saveStatus = $("#save-status");
const dirtyChip = $("#dirty-chip");
const draftBanner = $("#draft-banner");
const settingsDialog = $("#settings-dialog");
const toastElement = $("#toast");
const publishBtn = $("#publish-btn");
const exportBtn = $("#export-btn");
const thumbnailImage = $("#thumb-preview-img");
const thumbnailFallback = $("#thumb-preview-fallback");
const videoHint = $("#video-hint");

let state = null;
let serverState = null;
let index = -1;
let dirty = false;
let slugTouched = false;
let busy = false;
let toastTimer = null;

/* -------------------------------------------------------------------------- */
/* Storage helpers                                                            */
/* -------------------------------------------------------------------------- */

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function readPublishConfig() {
  const fallback = { repo: "", branch: "main", path: "data/projects.json", token: "" };
  try {
    return Object.assign(fallback, JSON.parse(readStorage(PUBLISH_KEY) || "{}"));
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Boot + gate                                                                */
/* -------------------------------------------------------------------------- */

function toast(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle("error", isError);
  toastElement.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("show"), 3200);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function unlock(event) {
  event.preventDefault();
  gateError.hidden = true;

  let hash = "";
  try {
    hash = await sha256(gatePass.value);
  } catch {
    gateError.textContent = "The gate needs HTTPS or localhost. Serve the folder over HTTP.";
    gateError.hidden = false;
    return;
  }

  if (hash !== ADMIN_HASH) {
    gateError.textContent = "Wrong passphrase.";
    gateError.hidden = false;
    gateCard.classList.remove("shake");
    void gateCard.offsetWidth;
    gateCard.classList.add("shake");
    gatePass.select();
    return;
  }

  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* unlocked for this page load only */
  }
  gatePass.value = "";
  start();
}

async function start() {
  gate.hidden = true;
  app.hidden = false;

  try {
    const data = await getData();
    serverState = structuredClone(data);

    let restored = false;
    const raw = readStorage(DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft && Array.isArray(draft.projects)) {
          state = draft;
          restored = true;
        }
      } catch {
        removeStorage(DRAFT_KEY);
      }
    }

    if (!state) state = structuredClone(data);

    draftBanner.hidden = !restored;
    renderList();

    if (state.projects.length) selectProject(0, { skipConfirm: true });
    else showEmptyEditor();
  } catch (error) {
    fatal(error.message);
  }
}

function fatal(message) {
  app.hidden = false;
  gate.hidden = true;
  form.hidden = true;
  emptyEditor.hidden = false;
  emptyEditor.innerHTML = `
    <p><strong>Could not load data/projects.json.</strong><br>${escapeHtml(message)}</p>
    <p class="hint">Serve the folder over HTTP: <code>npx serve .</code> then open <code>/admin.html</code>.</p>`;
}

/* -------------------------------------------------------------------------- */
/* Project list + editor                                                      */
/* -------------------------------------------------------------------------- */

function blankProject() {
  return {
    slug: "",
    title: "",
    tagline: "",
    thumbnail: "",
    video: "",
    tags: [],
    github: "",
    download: "",
    featured: false,
    published: new Date().toISOString().slice(0, 10),
    baseViews: 0,
    body: "## Overview\nWhat it does and who it's for.\n\n## Key mechanics\n- First mechanic\n- Second mechanic\n\n## Installation\n1. Drop the jar in `plugins/`.\n2. Restart the server.",
  };
}

function renderList() {
  if (!state) return;
  projectCount.textContent = `(${state.projects.length})`;

  if (!state.projects.length) {
    list.innerHTML = `<p class="side-note">No projects yet.</p>`;
    return;
  }

  list.innerHTML = state.projects
    .map((project, i) => {
      const tags = (project.tags || []).length;
      const meta = [
        project.featured ? "Featured" : "",
        `${tags} tag${tags === 1 ? "" : "s"}`,
        project.slug || "no slug",
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <button class="project-item ${i === index ? "active" : ""}" type="button" data-index="${i}">
          <span class="pi-title">${escapeHtml(project.title || "Untitled project")}</span>
          <span class="pi-meta">${escapeHtml(meta)}</span>
        </button>`;
    })
    .join("");
}

function showEmptyEditor() {
  index = -1;
  dirty = false;
  updateDirty();
  form.hidden = true;
  emptyEditor.hidden = false;
  deleteBtn.hidden = true;
  renderList();
}

function selectProject(nextIndex, { skipConfirm = false } = {}) {
  if (!state) return;
  if (!skipConfirm && dirty && !confirm("Discard the unsaved changes in this form?")) return;

  const project = state.projects[nextIndex];
  if (!project) {
    showEmptyEditor();
    return;
  }

  index = nextIndex;
  dirty = false;
  slugTouched = true;
  populate(project);
  clearErrors();
  updateDirty();
  renderList();

  form.hidden = false;
  emptyEditor.hidden = true;
  deleteBtn.hidden = false;
  saveStatus.textContent = "";
  formTitle.textContent = project.title || "Edit project";
}

function populate(project) {
  const fields = form.elements;
  fields.title.value = project.title || "";
  fields.slug.value = project.slug || "";
  fields.tagline.value = project.tagline || "";
  fields.tags.value = (project.tags || []).join(", ");
  fields.published.value = project.published || "";
  fields.baseViews.value = project.baseViews ?? 0;
  fields.thumbnail.value = project.thumbnail || "";
  fields.video.value = project.video || "";
  fields.github.value = project.github || "";
  fields.download.value = project.download || "";
  fields.featured.checked = Boolean(project.featured);
  fields.body.value = project.body || "";

  updateThumbnailPreview(project.thumbnail);
  updateVideoHint(project.video);
  switchTab("write");
}

function startNew() {
  if (!state) return;
  if (dirty && !confirm("Discard the unsaved changes in this form?")) return;

  index = -1;
  dirty = true;
  slugTouched = false;
  form.reset();
  populate(blankProject());
  clearErrors();
  updateDirty();
  renderList();

  form.hidden = false;
  emptyEditor.hidden = true;
  deleteBtn.hidden = true;
  saveStatus.textContent = "";
  formTitle.textContent = "New project";
  fieldsFocus("title");
}

function fieldsFocus(name) {
  form.elements[name]?.focus();
}

function readForm() {
  const data = new FormData(form);
  const rawTags = String(data.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const tags = rawTags.filter(
    (tag, i) => rawTags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === i
  );

  const existing = index >= 0 ? state.projects[index] : {};

  return {
    ...existing,
    title: String(data.get("title") || "").trim(),
    slug: String(data.get("slug") || "").trim().toLowerCase(),
    tagline: String(data.get("tagline") || "").trim(),
    thumbnail: String(data.get("thumbnail") || "").trim(),
    video: String(data.get("video") || "").trim(),
    tags,
    github: String(data.get("github") || "").trim(),
    download: String(data.get("download") || "").trim(),
    featured: data.get("featured") === "on",
    published: String(data.get("published") || ""),
    baseViews: Math.max(0, Math.floor(Number(data.get("baseViews")) || 0)),
    body: String(data.get("body") || ""),
  };
}

function save({ silent = false } = {}) {
  if (!state) return false;

  const project = readForm();
  const others = state.projects.filter((_, i) => i !== index);
  const errors = validateProject(project, others);
  showErrors(errors);

  if (Object.keys(errors).length) {
    if (!silent) toast("Fix the highlighted fields first.", true);
    return false;
  }

  if (index === -1) {
    state.projects.unshift(project);
    index = 0;
  } else {
    state.projects[index] = project;
  }

  dirty = false;
  updateDirty();
  persist();
  renderList();

  form.elements.slug.value = project.slug;
  form.elements.title.value = project.title;
  formTitle.textContent = project.title;
  deleteBtn.hidden = false;
  saveStatus.textContent = "Saved locally";

  if (!silent) toast("Saved to local draft");
  return true;
}

function persist() {
  if (!state) return;
  if (!writeStorage(DRAFT_KEY, JSON.stringify(state))) {
    toast("Could not save the draft — browser storage is full or blocked.", true);
  }
}

function clearErrors() {
  form.querySelectorAll(".field-error").forEach((element) => {
    element.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((element) => {
    element.removeAttribute("aria-invalid");
    element.removeAttribute("aria-describedby");
  });
}

function showErrors(errors) {
  clearErrors();

  for (const [key, message] of Object.entries(errors)) {
    const error = form.querySelector(`.field-error[data-error="${key}"]`);
    const field = form.elements[key];

    if (error) {
      if (!error.id) error.id = `err-${key}`;
      error.textContent = message;
    }
    if (field) {
      field.setAttribute("aria-invalid", "true");
      if (error) field.setAttribute("aria-describedby", error.id);
    }
  }

  form.querySelector('[aria-invalid="true"]')?.focus();
}

function updateDirty() {
  dirtyChip.hidden = !dirty;
}

function updateThumbnailPreview(value) {
  if (!thumbnailImage || !thumbnailFallback) return;

  if (!value) {
    thumbnailImage.hidden = true;
    thumbnailImage.removeAttribute("src");
    thumbnailFallback.hidden = false;
    return;
  }

  thumbnailImage.hidden = false;
  thumbnailFallback.hidden = true;
  thumbnailImage.src = value;
}

function updateVideoHint(value) {
  if (!videoHint) return;
  videoHint.classList.remove("is-error");

  if (!value) {
    videoHint.textContent = "";
    return;
  }

  const parsed = parseVideo(value);
  if (parsed) {
    const label = parsed.type === "file" ? "Direct video" : parsed.type === "youtube" ? "YouTube" : "Vimeo";
    videoHint.textContent = `${label} video detected.`;
  } else {
    videoHint.textContent = "Not a recognised video URL — the detail page will fall back to the thumbnail.";
    videoHint.classList.add("is-error");
  }
}

function switchTab(tab) {
  const textarea = form.elements.body;
  const preview = $("#body-preview");

  document.querySelectorAll(".tab").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === tab));
  });

  textarea.hidden = tab !== "write";
  preview.hidden = tab !== "preview";

  if (tab === "preview") preview.innerHTML = renderMarkdown(textarea.value);
}

/* -------------------------------------------------------------------------- */
/* Import / export                                                            */
/* -------------------------------------------------------------------------- */

function ensureSaved() {
  if (form.hidden) return true;
  if (!dirty && index !== -1) return true;
  return save({ silent: true });
}

function downloadJson() {
  if (!state) return;
  if (!ensureSaved()) {
    toast("Fix the highlighted fields first.", true);
    return;
  }

  const json = `${JSON.stringify(state, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "projects.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  removeStorage(DRAFT_KEY);
  draftBanner.hidden = true;
  saveStatus.textContent = "Exported projects.json";
  toast("Exported — commit it to data/projects.json");
}

async function importJson(file) {
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.projects)) {
      throw new Error("The file must contain a projects array.");
    }
    if (dirty && !confirm("Replace the current draft with the imported file?")) return;

    state = {
      version: parsed.version ?? 1,
      site: parsed.site || state?.site || serverState?.site || {},
      projects: parsed.projects,
    };

    index = -1;
    dirty = false;
    updateDirty();
    persist();
    draftBanner.hidden = true;
    renderList();

    if (state.projects.length) selectProject(0, { skipConfirm: true });
    else showEmptyEditor();

    saveStatus.textContent = `Imported ${state.projects.length} projects`;
    toast(`Imported ${state.projects.length} projects into the draft`);
  } catch (error) {
    toast(`Import failed: ${error.message}`, true);
  }
}

async function reloadFromServer() {
  if (dirty && !confirm("Discard unsaved changes and reload from the server?")) return;

  try {
    const data = await getData({ fresh: true });
    serverState = structuredClone(data);
    state = structuredClone(data);
    removeStorage(DRAFT_KEY);
    draftBanner.hidden = true;
    index = -1;
    dirty = false;
    updateDirty();
    renderList();

    if (state.projects.length) selectProject(0, { skipConfirm: true });
    else showEmptyEditor();

    toast("Reloaded data/projects.json");
  } catch (error) {
    toast(error.message, true);
  }
}

/* -------------------------------------------------------------------------- */
/* GitHub publish                                                             */
/* -------------------------------------------------------------------------- */

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function githubError(response) {
  let detail = "";
  try {
    detail = (await response.json())?.message || "";
  } catch {
    /* no JSON body */
  }

  if (response.status === 401) return "GitHub rejected the token. Check it and try again.";
  if (response.status === 403) return "The token may lack Contents: write, or GitHub is rate-limiting.";
  if (response.status === 404) return "Repository or file not found. Check the repo name, branch and path.";
  if (response.status === 409) return "The file changed on GitHub. Reload this page, then reapply your draft.";
  if (response.status === 422) return "GitHub rejected the commit. Check the branch name.";
  return `GitHub error ${response.status}${detail ? `: ${detail}` : ""}`;
}

function setBusy(value) {
  busy = value;
  publishBtn.disabled = value;
  exportBtn.disabled = value;
  publishBtn.textContent = value ? "Publishing…" : "Publish";
  publishBtn.setAttribute("aria-busy", String(value));
}

async function publish() {
  if (busy || !state) return;

  if (!ensureSaved()) {
    toast("Fix the highlighted fields first.", true);
    return;
  }

  const config = readPublishConfig();
  if (!config.repo || !config.token) {
    openSettings();
    toast("Add a repository and token to publish.", true);
    return;
  }

  setBusy(true);
  saveStatus.textContent = "Publishing…";

  try {
    const path = config.path
      .replace(/^\/+/, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const api = `https://api.github.com/repos/${config.repo}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    let sha = null;
    const current = await fetch(`${api}?ref=${encodeURIComponent(config.branch)}`, { headers });

    if (current.status === 200) {
      sha = (await current.json()).sha;
    } else if (current.status !== 404) {
      throw new Error(await githubError(current));
    }

    const response = await fetch(api, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "content: update projects via admin",
        content: toBase64(`${JSON.stringify(state, null, 2)}\n`),
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!response.ok) throw new Error(await githubError(response));

    const result = await response.json();
    const commit = result.commit?.sha?.slice(0, 7) || "";
    serverState = structuredClone(state);
    removeStorage(DRAFT_KEY);
    draftBanner.hidden = true;
    saveStatus.textContent = `Published${commit ? ` · ${commit}` : ""}`;
    toast(commit ? `Published to GitHub · ${commit}` : "Published to GitHub");
  } catch (error) {
    saveStatus.textContent = "";
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

/* -------------------------------------------------------------------------- */
/* Settings dialog                                                            */
/* -------------------------------------------------------------------------- */

function openSettings() {
  const config = readPublishConfig();
  $("#s-repo").value = config.repo || "";
  $("#s-branch").value = config.branch || "main";
  $("#s-path").value = config.path || "data/projects.json";
  $("#s-token").value = config.token || "";
  settingsDialog.showModal();
  $("#s-repo").focus();
}

function saveSettings() {
  const repo = $("#s-repo").value.trim();
  const branch = $("#s-branch").value.trim() || "main";
  const path = $("#s-path").value.trim().replace(/^\/+/, "") || "data/projects.json";
  const token = $("#s-token").value.trim();

  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    toast("Repository should look like owner/name.", true);
    $("#s-repo").focus();
    return;
  }

  if (!writeStorage(PUBLISH_KEY, JSON.stringify({ repo, branch, path, token }))) {
    toast("Could not store settings in this browser.", true);
    return;
  }

  settingsDialog.close();
  toast("Publish settings saved");
}

function forgetToken() {
  $("#s-token").value = "";
  const config = readPublishConfig();
  config.token = "";
  writeStorage(PUBLISH_KEY, JSON.stringify(config));
  toast("Token removed from this browser");
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                     */
/* -------------------------------------------------------------------------- */

function wire() {
  gateForm.addEventListener("submit", unlock);

  $("#new-btn").addEventListener("click", startNew);
  $("#export-btn").addEventListener("click", downloadJson);
  publishBtn.addEventListener("click", publish);
  $("#settings-btn").addEventListener("click", openSettings);
  $("#settings-close").addEventListener("click", () => settingsDialog.close());
  $("#settings-cancel").addEventListener("click", () => settingsDialog.close());
  $("#settings-save").addEventListener("click", saveSettings);
  $("#forget-token").addEventListener("click", forgetToken);
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    importJson(file).finally(() => {
      event.target.value = "";
    });
  });
  $("#reload-btn").addEventListener("click", reloadFromServer);

  $("#discard-draft").addEventListener("click", () => {
    if (!confirm("Discard the local draft and restore data/projects.json?")) return;
    removeStorage(DRAFT_KEY);
    state = structuredClone(serverState);
    draftBanner.hidden = true;
    index = -1;
    dirty = false;
    updateDirty();
    renderList();

    if (state.projects.length) selectProject(0, { skipConfirm: true });
    else showEmptyEditor();
    toast("Local draft discarded");
  });

  $("#lock-btn").addEventListener("click", () => {
    if (dirty && !confirm("Lock the admin and lose unsaved changes?")) return;
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch {
      /* nothing to clear */
    }
    location.reload();
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest(".project-item");
    if (item) selectProject(Number(item.dataset.index));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });

  form.addEventListener("input", (event) => {
    dirty = true;
    updateDirty();

    if (event.target.name === "title" && !slugTouched) {
      form.elements.slug.value = slugify(event.target.value);
    }
    if (event.target.name === "thumbnail") updateThumbnailPreview(event.target.value);
    if (event.target.name === "video") updateVideoHint(event.target.value);
  });

  form.elements.slug.addEventListener("input", () => {
    slugTouched = true;
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  thumbnailImage.addEventListener("error", () => {
    thumbnailImage.hidden = true;
    thumbnailFallback.hidden = false;
  });
  thumbnailImage.addEventListener("load", () => {
    thumbnailImage.hidden = false;
    thumbnailFallback.hidden = true;
  });

  deleteBtn.addEventListener("click", () => {
    if (index < 0 || !state) return;
    const project = state.projects[index];
    if (!confirm(`Delete “${project.title || "this project"}” from the draft?`)) return;

    state.projects.splice(index, 1);
    index = -1;
    dirty = false;
    updateDirty();
    persist();
    renderList();

    if (state.projects.length) selectProject(0, { skipConfirm: true });
    else showEmptyEditor();
    toast("Deleted from draft");
  });

  settingsDialog.addEventListener("click", (event) => {
    if (event.target === settingsDialog) settingsDialog.close();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

initTheme();
wire();

let unlocked = false;
try {
  unlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";
} catch {
  /* storage unavailable — gate stays */
}

if (unlocked) start();
