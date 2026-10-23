import { getData, initTheme, safeUrl } from "./core.js";

/**
 * Theme, footer year and site copy. Static HTML is the fallback, so the page
 * still reads correctly if projects.json fails to load.
 */
export async function initSite() {
  initTheme();

  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  try {
    const { site = {} } = await getData();

    document.querySelectorAll("[data-site]").forEach((element) => {
      const value = site[element.dataset.site];
      if (value != null && value !== "") element.textContent = value;
    });

    document.querySelectorAll("[data-site-href]").forEach((element) => {
      const url = safeUrl(site[element.dataset.siteHref]);
      if (!url) {
        element.hidden = true;
        return;
      }
      element.href = url.href;
      if (element.target === "_blank") element.rel = "noopener";
    });
  } catch {
    /* keep the copy already in the HTML */
  }
}
