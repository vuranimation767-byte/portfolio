# Minecraft plugin portfolio

A clean, fast portfolio for Minecraft plugins and dev projects. Plain HTML, CSS and JavaScript — no framework, no build step, no server. It deploys straight to GitHub Pages and includes a browser-based content manager.

> **Demo content:** the name “Alex Rivers”, GitHub links, thumbnails and demo videos are placeholders. Replace them in `data/projects.json` and `assets/thumbs/` before sharing the site.

## What's included

- Filterable, searchable project gallery with per-card view counts.
- Project pages with YouTube / Vimeo / MP4 showcase video, Markdown docs, GitHub and download links.
- GitHub Discussions comments via Giscus (optional).
- Admin editor at `admin.html`: add/edit/delete projects, validate fields, preview Markdown, save drafts in the browser, import/export JSON, optional one-click publish to GitHub.
- Light/dark theme, responsive layout, keyboard support, reduced-motion support.

## Local preview

The site fetches `data/projects.json`, so open it over HTTP — not `file://`.

```bash
cd portfolio
npx serve .
```

Then open the printed URL. Any static server works, e.g. `npx http-server`, or the VS Code Live Server extension.

## Deploy to GitHub Pages

1. Create a repository and push this folder to `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Choose **main** and **/(root)**, then save.
4. The site goes live at `https://<username>.github.io/<repo>/` (or `https://<username>.github.io/` for a user site).

`.nojekyll` is included so GitHub serves files as-is. GitHub Pages caches aggressively — allow a few minutes after a commit.

Project links use `project.html?p=slug`, which works on any static host and needs no routing rules.

## Admin panel

Open `/admin.html` after deploying (for example `https://username.github.io/portfolio/admin.html`). GitHub Pages has no extensionless routing, so use the `.html` path — `/admin` alone will 404.

**Default passphrase:** `minecraft`

That gate is cosmetic: the page is static, so the check can be bypassed. It only keeps the editor out of casual view. What actually protects your content is your GitHub account — nobody can publish without your token. Don't reuse a sensitive password.

### Change the passphrase

Generate a SHA-256 hex digest in the browser console:

```js
const data = new TextEncoder().encode("your-new-passphrase");
crypto.subtle.digest("SHA-256", data).then((buffer) =>
  console.log([...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join(""))
);
```

Replace `ADMIN_HASH` at the top of `assets/js/admin.js` with the output. Changing the hash does not protect the public JSON — it is already public.

### Saving and publishing

- **Save to draft** writes to `localStorage` in that browser. Refresh restores the draft.
- **Export JSON** downloads `projects.json`. Commit it to `data/projects.json`.
- **Publish** commits the file to GitHub from the browser.

For publishing, create a **fine-grained personal access token** with **Contents: read and write** on just the portfolio repository. Enter the repo (`owner/repo`), branch, file path and token in **Settings**. The token is stored in this browser's `localStorage` and is never written into the site. Revoke it on GitHub if a device is lost, or use **Forget token**. Use the **Lock** button to end an admin session.

The editor needs HTTPS or localhost because it uses `crypto.subtle` for the passphrase hash.

## Content model

`data/projects.json` holds the site copy and every project.

### Site

| Field | Purpose |
| --- | --- |
| `name`, `role`, `headline`, `tagline`, `about` | Hero, header, footer and About copy |
| `github` | Profile link used by the nav, hero and footer |
| `features.views` | `false` hides all view counters and stops counting |
| `features.comments` | `false` hides comments even when Giscus is configured |
| `counterNamespace` | Abacus namespace — keep this stable (see Views) |
| `giscus` | GitHub Discussions comment config (see Comments) |

### Project

| Field | Notes |
| --- | --- |
| `slug` | Unique, lowercase, used in `project.html?p=`. Spaces become dashes. |
| `title`, `tagline` | Card and detail page copy |
| `thumbnail` | Path like `assets/thumbs/name.webp`, or an https URL |
| `video` | YouTube, Vimeo or direct `.mp4` / `.webm` URL. Empty is fine. |
| `tags` | Array of strings. They become gallery filter chips. |
| `github`, `download` | Optional http(s) links |
| `featured` | Featured projects sort first |
| `published` | `YYYY-MM-DD`; used for ordering and the detail meta row |
| `baseViews` | Cosmetic starting number added to the live counter. Use `0` for honest counts. |
| `body` | Markdown: overview, key mechanics, installation |

Add a project by hand or through the admin. A minimal entry:

```json
{
  "slug": "my-plugin",
  "title": "My Plugin",
  "tagline": "One line about what it does.",
  "thumbnail": "assets/thumbs/my-plugin.webp",
  "video": "https://youtu.be/VIDEO_ID",
  "tags": ["Paper", "Java"],
  "github": "https://github.com/you/my-plugin",
  "download": "https://github.com/you/my-plugin/releases/latest",
  "featured": false,
  "published": "2026-01-20",
  "baseViews": 0,
  "body": "## Overview\nWhat it does.\n\n## Installation\n1. Drop the jar in `plugins/`."
}
```

## Images

- 1600×900 (16:9), WebP recommended, under ~200 KB.
- Put files in `assets/thumbs/` and reference `assets/thumbs/name.webp`.
- Cards reserve the aspect ratio, so missing or slow images don't shift the layout.
- A broken or missing thumbnail falls back to an initials tile.
- The admin previews a path/URL but does not upload binaries — add the image to the repo yourself.

## Videos

Paste a YouTube, Vimeo or direct video URL. YouTube/Vimeo load only after a click, so no heavy embed scripts on first paint. Direct MP4/WebM files use a native `<video>` element with `preload="none"`. If the URL isn't recognised, the detail page shows the thumbnail instead.

## Views (Abacus)

Counts use the free [Abacus](https://abacus.jasoncameron.dev/) counter API — no account, no server, CORS enabled. The detail page increments the counter once per browser session; the gallery reads counts lazily and caches them for ten minutes.

- Set `counterNamespace` to a stable value such as your domain. Changing it starts from zero.
- `baseViews` is added on top of the live count (the demo uses it so the design looks populated). Set it to `0` for real numbers.
- Localhost does not increment counters, but it can read them.
- Any third-party counter can be inflated or go offline. If it fails, cards quietly fall back to `baseViews`.

## Comments (Giscus)

Comments are **hidden until configured**. One-time setup:

1. Push the site to a **public** GitHub repository.
2. Repo **Settings → General → Features → Discussions**.
3. Install the [giscus app](https://github.com/apps/giscus) on that repository.
4. Open [giscus.app](https://giscus.app), enter the repo, choose a category (e.g. Announcements), and copy the `data-repo-id` and `data-category-id` values.
5. Fill in `site.giscus` in `data/projects.json`:

```json
"giscus": {
  "repo": "you/portfolio",
  "repoId": "R_kgDO…",
  "category": "Announcements",
  "categoryId": "DIC_kwDO…"
}
```

Each project maps to its own Discussion using the slug. Visitors need a GitHub account to comment; all threads are moderated in the repo's Discussions tab. The widget loads only when the comments section approaches the viewport, and follows the light/dark theme.

## Customising

- **Copy:** the `site` block in `data/projects.json` and the static fallbacks in the HTML.
- **Colours:** `--accent`, `--bg`, `--card`, `--text` and friends at the top of `assets/css/style.css`. Dark mode is the `[data-theme="dark"]` block.
- **Fonts:** system UI stack by default (no download). Swap `--font` for a self-hosted typeface if you want one.
- **Logo:** a CSS gradient square (`.brand-mark`), plus `assets/favicon.svg`. Replace both with your own mark.
- **Thumbnails:** the six SVGs in `assets/thumbs/` are designed placeholders.

## Tests

Open `/dev/tests.html` through the local server. It runs assertion checks for slug generation, view formatting, URL safety, video parsing, and project validation. It is not linked from the site.

## File map

```
.
├─ index.html                  gallery
├─ project.html                project detail (?p=slug)
├─ admin.html                  content manager
├─ 404.html
├─ data/projects.json          site + projects (source of truth)
├─ assets/
│  ├─ css/style.css
│  ├─ js/core.js               helpers, data, views, theme
│  ├─ js/site.js               header/footer copy
│  ├─ js/gallery.js
│  ├─ js/project.js
│  ├─ js/admin.js
│  ├─ js/vendor/marked.min.js  Markdown renderer (MIT, pinned)
│  ├─ thumbs/
│  └─ favicon.svg
├─ dev/tests.html
├─ .nojekyll
└─ README.md
```

## Known limits

- No real authentication on a static host. The admin gate is privacy, not security; GitHub protects publishing.
- Comments and view counts depend on GitHub and Abacus respectively. Both are optional and degrade quietly.
- Search engines see one `project.html` with client-rendered project content; individual projects are still shareable via query string. If per-project SEO matters, move to a static generator (Astro/Eleventy) later.
- GitHub Pages has no server-side redirects or rewrites. Use the `.html` URLs.
