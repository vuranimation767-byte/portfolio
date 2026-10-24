import { getData, initTheme, safeUrl } from "./core.js";

/**
 * Theme, footer year, site copy and entrance motion. Static HTML is the
 * fallback, so the page still reads correctly if projects.json fails to load.
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

  initMotion();
}

function initMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const header = document.querySelector(".site-header");
  const monument = document.querySelector("[data-monument]");
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (header) {
        if (y > 140 && y > lastY) header.classList.add("is-hidden");
        else header.classList.remove("is-hidden");
      }
      // The wordmark completes the last few percent of its rise as you scroll.
      if (monument) {
        const t = Math.min(1, Math.max(0, y / (window.innerHeight * 0.5)));
        monument.style.setProperty("--monument-scale", String(0.94 + t * 0.06));
      }
      lastY = y;
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  document.querySelectorAll(".about-intro, .plugin-block, .footer-monument, .plugin-media figure").forEach((element) => reveal.observe(element));
}
