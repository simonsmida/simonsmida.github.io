/*
 * Site behaviour: theme, background field picker, expandable card lists,
 * article thumbnail transitions, and client-side navigation between the
 * About, Research, Writing, and Projects views.
 */
(() => {
  "use strict";

  const LIGHT_THEME = "slate-blue";
  const DARK_THEME = "midnight-navy";
  const THEME_STORAGE_KEY = "site-theme";
  const FIELD_STORAGE_KEY = "site-field";
  const COMPACT_LAYOUT = window.matchMedia("(max-width: 640px)");
  const INLINE_LAYOUT = window.matchMedia("(min-width: 1101px)");
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SECTIONS = ["research", "writing", "projects"];

  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const isModifiedClick = (event) => (
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  );

  function remember(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Preferences still apply for the current visit without storage. */
    }
  }

  /* ---- Theme ------------------------------------------------------------ */

  function applyTheme(theme) {
    const isDark = theme === DARK_THEME;
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = isDark ? "#101d27" : "#eef2f3";

    const button = document.querySelector("[data-theme-trigger]");
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);

    /* Browsers repaint the tab icon reliably when the link element itself is
       replaced, not only when its href changes. */
    const icon = document.querySelector("[data-theme-icon]");
    const nextIcon = icon.cloneNode(true);
    nextIcon.href = isDark ? icon.dataset.dark : icon.dataset.light;
    icon.replaceWith(nextIcon);

    remember(THEME_STORAGE_KEY, theme);
    emit("site-theme-change", { theme });
  }

  function initializeTheme() {
    applyTheme(document.documentElement.dataset.theme === DARK_THEME ? DARK_THEME : LIGHT_THEME);
    document.querySelector("[data-theme-trigger]").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === DARK_THEME ? LIGHT_THEME : DARK_THEME);
    });
  }

  /* ---- Background field picker ------------------------------------------- */

  function initializeFieldPicker() {
    const picker = document.querySelector("[data-field-picker]");
    const fields = window.SITE_FIELDS;
    if (!picker || !fields) return;

    const trigger = picker.querySelector("[data-field-trigger]");
    const menu = picker.querySelector("[data-field-menu]");
    const mark = picker.querySelector("[data-field-mark]");
    const current = picker.querySelector("[data-field-current]");

    menu.replaceChildren(...Object.entries(fields).map(([name, field]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.role = "menuitemradio";
      option.dataset.fieldOption = name;
      option.innerHTML = `<span aria-hidden="true">${field.mark}</span><span>${field.label}</span>`;
      return option;
    }));

    function apply(name, { save = true } = {}) {
      const field = fields[name] ? name : Object.keys(fields)[0];
      document.documentElement.dataset.field = field;
      mark.textContent = fields[field].mark;
      current.textContent = fields[field].label;
      menu.querySelectorAll("[data-field-option]").forEach((option) => {
        option.setAttribute("aria-checked", String(option.dataset.fieldOption === field));
      });
      if (save) remember(FIELD_STORAGE_KEY, field);
      emit("site-field-change", { field });
    }

    function close({ focus = false } = {}) {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (focus) trigger.focus();
    }

    trigger.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector('[aria-checked="true"]')?.focus();
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-field-option]");
      if (!option) return;
      apply(option.dataset.fieldOption);
      close({ focus: true });
    });
    document.addEventListener("pointerdown", (event) => {
      if (!menu.hidden && !picker.contains(event.target)) close();
    });
    picker.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close({ focus: true });
    });

    apply(document.documentElement.dataset.field, { save: false });
  }

  /* ---- Expandable card lists ---------------------------------------------- */

  const INITIAL_CARD_COUNT = 3;

  function initializeCardLists(root = document) {
    root.querySelectorAll("[data-card-list]").forEach((list) => {
      const button = root.querySelector(`[data-view-more][aria-controls="${list.id}"]`);
      const cards = list.querySelectorAll(":scope > .content-card");
      if (!button) return;
      if (cards.length <= INITIAL_CARD_COUNT) {
        button.hidden = true;
        return;
      }

      const label = button.querySelector("[data-view-more-label]");
      const icon = button.querySelector(".view-more-icon");
      const render = (expanded) => {
        list.dataset.expanded = String(expanded);
        button.hidden = false;
        button.setAttribute("aria-expanded", String(expanded));
        label.textContent = expanded ? "Show less" : `View more ${list.dataset.itemLabel || "items"}`;
        icon.textContent = expanded ? "↑" : "↓";
        if (!expanded) list.closest(".content-list-region")?.scrollTo({ top: 0 });
        emit("site-layout-change");
      };

      render(false);
      button.addEventListener("click", () => render(list.dataset.expanded !== "true"));
    });
  }

  /* ---- Article thumbnail transitions --------------------------------------- */

  /* The clicked thumbnail shares a view-transition name with the article hero
     so browsers with cross-document View Transitions morph between them. */
  function initializeArticleTransitions() {
    /* Chrome rejects its own transition promise whenever it decides to skip a
       cross-document transition. The navigation itself is unaffected, so keep
       that one rejection out of the console and let every other error through. */
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason?.name === "AbortError" && event.reason.message === "Transition was skipped") {
        event.preventDefault();
      }
    });

    const clearNames = () => {
      document.querySelectorAll("[data-view-transition-name]").forEach((media) => {
        media.style.removeProperty("view-transition-name");
      });
    };

    document.addEventListener("click", (event) => {
      const link = event.target.closest?.(".content-card a[href]");
      const media = link?.closest(".content-card")?.querySelector("[data-view-transition-name]");
      if (!media || isModifiedClick(event)) return;
      clearNames();
      media.style.viewTransitionName = media.dataset.viewTransitionName;
    });
    window.addEventListener("pageshow", clearNames);
  }

  /* ---- Client-side navigation ---------------------------------------------- */

  /*
   * The About page has three presentations of a section:
   *   – wide screens show the section's cards in a panel beside the biography
   *   – compact screens stack every section below the biography and scroll
   *   – anything between swaps in the standalone section page
   * Section state lives in the URL hash on About so a refresh restores it.
   */
  function initializeNavigation() {
    const nav = document.querySelector("[data-site-nav]");
    const links = [...nav.querySelectorAll("a[href]")];
    const pages = new Map();
    const indicator = document.createElement("span");
    let mobileSectionsReady = Promise.resolve(false);
    let mobileScrollFrame = 0;
    let mobileScrollTarget = null;
    let mobileScrollTimer = 0;

    const isLanding = () => document.body.classList.contains("landing-page");
    const isHomePath = (pathname) => pathname === "/" || pathname.endsWith("/index.html");
    const sectionOf = (pathname) => SECTIONS.find((name) => pathname.endsWith(`/${name}.html`)) || null;
    const sectionUrl = (name) => new URL(`/${name}.html`, window.location.origin);

    function sectionFromHash(url) {
      const name = url.hash.replace(/^#\/?/, "").replace(/\.html$/, "");
      return isHomePath(url.pathname) && SECTIONS.includes(name) ? name : null;
    }

    async function fetchPage(url) {
      if (!pages.has(url.pathname)) {
        pages.set(url.pathname, window.fetch(url.href, { headers: { Accept: "text/html" } })
          .then(async (response) => {
            if (!response.ok) throw new Error(`Page request failed: ${response.status}`);
            return new DOMParser().parseFromString(await response.text(), "text/html");
          })
          .catch((error) => {
            pages.delete(url.pathname);
            throw error;
          }));
      }
      return pages.get(url.pathname);
    }

    /* Navigation indicator */

    function syncIndicator() {
      const active = links.find((link) => link.getAttribute("aria-current") === "page" && link.offsetWidth > 0);
      if (!active) {
        indicator.classList.remove("is-ready");
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      nav.style.setProperty("--nav-indicator-x", `${rect.left - navRect.left - 3}px`);
      nav.style.setProperty("--nav-indicator-width", `${rect.width + 6}px`);
      indicator.classList.add("is-ready");
    }

    function setCurrent(pathname) {
      links.forEach((link) => {
        const linkPath = new URL(link.href).pathname;
        const current = isHomePath(pathname) ? isHomePath(linkPath) : linkPath === pathname;
        if (current) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      syncIndicator();
      requestAnimationFrame(syncIndicator);
    }

    /* Document updates */

    function importCards(sourceDocument, sourceUrl) {
      return [...sourceDocument.querySelectorAll(".content-card")].map((source) => {
        const card = document.importNode(source, true);
        card.querySelectorAll("[href], [src]").forEach((element) => {
          for (const attribute of ["href", "src"]) {
            const value = element.getAttribute(attribute);
            if (value && !value.startsWith("#")) {
              element.setAttribute(attribute, new URL(value, sourceUrl).href);
            }
          }
        });
        card.querySelectorAll("img").forEach((image) => { image.loading = "eager"; });
        return card;
      });
    }

    function applyMetadata(nextDocument) {
      document.title = nextDocument.title;
      document.querySelector('meta[name="description"]').content = (
        nextDocument.querySelector('meta[name="description"]')?.content || ""
      );
    }

    function landingUrl(name) {
      return name ? `/#${name}` : "/";
    }

    /* Wide About: cards render in the panel beside the biography. */

    async function showInlineSection(name, nextDocument, { push }) {
      const panel = document.querySelector("[data-inline-panel]");
      const list = panel.querySelector("[data-inline-list]");
      const title = nextDocument?.querySelector(".page-intro h1")?.textContent;
      const cards = nextDocument ? importCards(nextDocument, sectionUrl(name)) : [];
      const wasOpen = !panel.hidden;
      const willOpen = Boolean(name && cards.length && title);
      if (name && !willOpen) return false;

      if (wasOpen && !REDUCED_MOTION.matches) {
        panel.dataset.motion = "leaving";
        await new Promise((resolve) => window.setTimeout(resolve, 140));
      }

      if (willOpen) {
        cards.forEach((card, index) => card.style.setProperty("--card-index", index));
        panel.querySelector("[data-inline-title]").textContent = title;
        list.replaceChildren(...cards);
        const more = panel.querySelector("[data-inline-more]");
        more.href = sectionUrl(name).pathname;
        more.textContent = `View all ${title.toLowerCase()} ↗`;
        applyMetadata(nextDocument);
      } else {
        list.replaceChildren();
        document.title = "Šimon Šmída";
      }

      document.body.classList.toggle("inline-content-active", willOpen);
      panel.hidden = !willOpen;
      panel.dataset.motion = willOpen && !REDUCED_MOTION.matches ? "entering" : "";
      if (willOpen) list.dataset.motion = REDUCED_MOTION.matches ? "" : "entering";
      panel.getBoundingClientRect();
      requestAnimationFrame(() => {
        delete panel.dataset.motion;
        window.setTimeout(() => delete list.dataset.motion, 900);
      });

      setCurrent(name ? sectionUrl(name).pathname : "/");
      if (push) window.history.pushState({}, "", landingUrl(name));
      emit("site-layout-change");
      return true;
    }

    /* Standalone section pages: swap the main element in place. */

    function swapPage(nextDocument, url, { push }) {
      const nextMain = nextDocument.querySelector("main");
      const currentMain = document.querySelector("main");
      if (!nextMain || !currentMain) return false;

      document.body.className = nextDocument.body.className;
      currentMain.replaceWith(document.importNode(nextMain, true));
      applyMetadata(nextDocument);
      setCurrent(url.pathname);
      if (push) window.history.pushState({}, "", url.href);
      window.scrollTo({ top: 0, behavior: "auto" });
      initializeCardLists(document);
      if (isLanding()) mobileSectionsReady = buildMobileSections();
      emit("site-layout-change");
      return true;
    }

    /* Compact About: every section is stacked below the biography. */

    function buildMobileSections() {
      const root = document.querySelector("[data-mobile-sections]");
      if (!root) return Promise.resolve(false);

      root.replaceChildren();

      return Promise.all(SECTIONS.map(async (name) => [name, await fetchPage(sectionUrl(name))]))
        .then((sections) => {
          sections.forEach(([name, sourceDocument]) => {
            const title = sourceDocument.querySelector(".page-intro h1")?.textContent;
            const cards = importCards(sourceDocument, sectionUrl(name));
            if (!title || !cards.length) return;

            const section = document.createElement("section");
            section.className = "mobile-tab-section";
            section.dataset.route = sectionUrl(name).pathname;
            section.setAttribute("aria-label", title);

            const list = document.createElement("div");
            list.className = "mobile-tab-section-list";
            list.append(...cards);
            section.append(list);
            root.append(section);
          });

          requestAnimationFrame(syncMobileSectionFromScroll);
          emit("site-layout-change");
          return true;
        })
        .catch(() => false);
    }

    /* Keep the selected tab tied to what is actually visible. This avoids an
       observer choosing the outgoing section halfway through a smooth scroll. */
    function syncMobileSectionFromScroll() {
      if (!isLanding() || !COMPACT_LAYOUT.matches) return;

      const sections = [
        document.querySelector(".hero[data-route]"),
        ...document.querySelectorAll(".mobile-tab-section"),
      ].filter(Boolean);
      if (!sections.length) return;

      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      const footerHeight = document.querySelector("footer")?.getBoundingClientRect().height || 0;

      if (mobileScrollTarget) {
        const arrived = Math.abs(mobileScrollTarget.getBoundingClientRect().top - headerHeight) < 3;
        if (!arrived) return;
        mobileScrollTarget = null;
        window.clearTimeout(mobileScrollTimer);
      }

      const viewportBottom = window.innerHeight - footerHeight;
      const visible = sections
        .map((section) => {
          const rect = section.getBoundingClientRect();
          const amount = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, headerHeight));
          return { section, amount };
        })
        .sort((a, b) => b.amount - a.amount)[0];
      if (!visible?.amount) return;

      const pathname = visible.section.dataset.route;
      document.body.classList.toggle("inline-content-active", !isHomePath(pathname));
      setCurrent(pathname);

      const section = sectionOf(pathname);
      const nextLocation = landingUrl(section);
      if (`${window.location.pathname}${window.location.hash}` !== nextLocation) {
        window.history.replaceState({}, "", nextLocation);
      }
    }

    function queueMobileScrollSync() {
      if (mobileScrollFrame) return;
      mobileScrollFrame = requestAnimationFrame(() => {
        mobileScrollFrame = 0;
        syncMobileSectionFromScroll();
      });
    }

    function scrollToMobileSection(pathname, { push = true, behavior = "smooth" } = {}) {
      const target = [document.querySelector(".hero[data-route]"), ...document.querySelectorAll(".mobile-tab-section")]
        .find((section) => section && (
          isHomePath(pathname) ? isHomePath(section.dataset.route) : section.dataset.route === pathname
        ));
      if (!target) return false;

      document.body.classList.toggle("inline-content-active", !isHomePath(pathname));
      setCurrent(pathname);
      const nextLocation = landingUrl(sectionOf(pathname));
      if (push && `${window.location.pathname}${window.location.hash}` !== nextLocation) {
        window.history.pushState({}, "", nextLocation);
      }

      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerHeight);
      mobileScrollTarget = target;
      window.clearTimeout(mobileScrollTimer);
      mobileScrollTimer = window.setTimeout(() => {
        mobileScrollTarget = null;
        syncMobileSectionFromScroll();
      }, behavior === "smooth" && !REDUCED_MOTION.matches ? 900 : 0);
      window.scrollTo({ top, behavior: REDUCED_MOTION.matches ? "auto" : behavior });
      return true;
    }

    /* Routing */

    let routing = false;
    let queuedNavigation = null;

    async function go(url, { push = true } = {}) {
      if (routing) {
        queuedNavigation = { url, push };
        return;
      }
      routing = true;
      const section = sectionOf(url.pathname) || sectionFromHash(url);
      const home = !section;

      try {
        if (isLanding() && COMPACT_LAYOUT.matches) {
          await mobileSectionsReady;
          if (queuedNavigation) return;
          if (scrollToMobileSection(section ? sectionUrl(section).pathname : "/", { push })) return;
        }

        if (isLanding() && INLINE_LAYOUT.matches) {
          const nextDocument = section ? await fetchPage(sectionUrl(section)) : null;
          if (await showInlineSection(section, nextDocument, { push })) return;
        }

        const target = home ? new URL("/", window.location.origin) : sectionUrl(section);
        const nextDocument = await fetchPage(target);
        if (!swapPage(nextDocument, target, { push })) window.location.assign(target.href);
      } catch {
        window.location.assign(url.href);
      } finally {
        routing = false;
        if (queuedNavigation) {
          const next = queuedNavigation;
          queuedNavigation = null;
          go(next.url, { push: next.push });
        }
      }
    }

    function prefetch(link) {
      const url = new URL(link.href);
      if (url.pathname !== window.location.pathname) fetchPage(url).catch(() => {});
    }

    /* Wiring */

    indicator.className = "site-nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    nav.append(indicator);
    nav.classList.add("has-motion-indicator");
    requestAnimationFrame(syncIndicator);
    window.addEventListener("resize", () => requestAnimationFrame(syncIndicator), { passive: true });

    links.forEach((link) => {
      link.addEventListener("pointerenter", () => prefetch(link), { once: true });
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented || isModifiedClick(event)) return;
        const mobileLanding = isLanding() && COMPACT_LAYOUT.matches;
        if (link.getAttribute("aria-current") === "page" && !mobileLanding) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        go(new URL(link.href));
      });
      prefetch(link);
    });

    window.addEventListener("popstate", () => go(new URL(window.location.href), { push: false }));
    window.addEventListener("scroll", queueMobileScrollSync, { passive: true });
    window.addEventListener("resize", queueMobileScrollSync, { passive: true });
    window.addEventListener("pointerdown", () => {
      if (!COMPACT_LAYOUT.matches) return;
      mobileScrollTarget = null;
      window.clearTimeout(mobileScrollTimer);
    }, { passive: true });

    /* When the window crosses a layout breakpoint, present the current
       section in the form that layout uses. */
    const relayout = () => {
      const url = new URL(window.location.href);
      const section = sectionOf(url.pathname) || sectionFromHash(url);
      if (!section) return;
      if (isLanding() || COMPACT_LAYOUT.matches) go(url, { push: false });
    };
    COMPACT_LAYOUT.addEventListener("change", relayout);
    INLINE_LAYOUT.addEventListener("change", relayout);

    if (isLanding()) {
      mobileSectionsReady = buildMobileSections();
      const initial = sectionFromHash(new URL(window.location.href));
      if (initial) mobileSectionsReady.then(() => go(new URL(window.location.href), { push: false }));
    }
  }

  /* ---- Startup ----------------------------------------------------------- */

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  initializeTheme();
  initializeFieldPicker();
  initializeCardLists();
  initializeArticleTransitions();
  if (document.querySelector("[data-site-nav]") && !document.body.classList.contains("article-page")) {
    initializeNavigation();
  }
})();
