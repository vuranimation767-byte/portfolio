import { getData, initTheme, safeUrl } from "./core.js";

/**
 * Shared public-page setup: theme, mobile menu, footer year, site copy and
 * scroll reveal. Static HTML is the fallback, so the page still reads
 * correctly if projects.json fails to load.
 */
export async function initSite() {
  initTheme();
  initMenu();
  initReveal();

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

function initMenu() {
  const button = document.querySelector(".menu-btn");
  const menu = document.querySelector("#mobile-menu");
  if (!button || !menu) return;

  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (menu.hidden) return;
    if (event.target.closest("#mobile-menu") || event.target.closest(".menu-btn")) return;
    setOpen(false);
  });
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((element) => element.classList.add("is-in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" }
  );

  items.forEach((element) => observer.observe(element));
}
