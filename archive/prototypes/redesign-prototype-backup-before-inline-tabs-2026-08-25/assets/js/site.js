(() => {
  "use strict";

  /* Theme */

  const THEME_STORAGE_KEY = "simon-site-palette";
  const LIGHT_THEME = "slate-blue";
  const DARK_THEME = "midnight-navy";
  const THEMES = new Set([LIGHT_THEME, DARK_THEME]);

  function readSavedTheme() {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return THEMES.has(savedTheme) ? savedTheme : LIGHT_THEME;
    } catch {
      return LIGHT_THEME;
    }
  }

  function updateThemeButton(theme) {
    const button = document.querySelector("[data-theme-trigger]");
    if (!button) return;

    const isDark = theme === DARK_THEME;
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  function applyTheme(theme, { save = true } = {}) {
    if (!THEMES.has(theme)) return;

    document.documentElement.dataset.theme = theme;
    updateThemeButton(theme);

    if (save) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Theme switching still works when browser storage is unavailable.
      }
    }

    window.dispatchEvent(new CustomEvent("site-theme-change"));
  }

  function initializeTheme() {
    applyTheme(readSavedTheme(), { save: false });

    document.querySelector("[data-theme-trigger]")?.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme;
      applyTheme(currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME);
    });
  }

  /* ASCII style picker */

  const ASCII_STORAGE_KEY = "simon-ascii-style";
  const ASCII_STYLES = [
    { value: "manifold", label: "Latent manifold", mark: "∿" },
    { value: "topography", label: "Latent topography", mark: "≋" },
    { value: "activation", label: "Activation fields", mark: "∧" },
    { value: "attention", label: "Transformer attention", mark: "×" },
    { value: "embedding", label: "Point cloud", mark: "∴" },
    { value: "pathology", label: "Computational pathology", mark: "◍" },
    { value: "loss", label: "Loss landscape", mark: "⌁" },
    { value: "cubes", label: "Feature cubes", mark: "◇" },
    { value: "flow", label: "Information flow", mark: "→" },
    { value: "network", label: "Neural network", mark: "⋈" },
    { value: "latent", label: "Latent space", mark: "◌" },
    { value: "orbit", label: "Orbit field", mark: "⊙" },
    { value: "cosmic", label: "Cosmic neural web", mark: "✦" }
  ];

  function readSavedAsciiStyle() {
    try {
      const savedStyle = window.localStorage.getItem(ASCII_STORAGE_KEY);
      return ASCII_STYLES.some(({ value }) => value === savedStyle)
        ? savedStyle
        : ASCII_STYLES[0].value;
    } catch {
      return ASCII_STYLES[0].value;
    }
  }

  function initializeAsciiPicker() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector("[data-ascii-picker]")) return;

    const picker = document.createElement("div");
    picker.className = "ascii-picker";
    picker.dataset.asciiPicker = "";
    picker.innerHTML = `
      <button class="ascii-picker-button" type="button" data-ascii-trigger aria-expanded="false" aria-controls="ascii-style-menu">
        <span class="ascii-picker-mark" data-ascii-mark aria-hidden="true">∿</span>
        <span class="ascii-picker-copy"><span>Field</span><span data-ascii-current>Latent manifold</span></span>
      </button>
      <div class="ascii-picker-menu" id="ascii-style-menu" role="menu" hidden>
        ${ASCII_STYLES.map(({ value, label, mark }) => `
          <button type="button" role="menuitemradio" data-ascii-option="${value}" aria-checked="false">
            <span aria-hidden="true">${mark}</span>${label}
          </button>
        `).join("")}
      </div>
    `;
    header.prepend(picker);

    const trigger = picker.querySelector("[data-ascii-trigger]");
    const menu = picker.querySelector(".ascii-picker-menu");
    const currentLabel = picker.querySelector("[data-ascii-current]");
    const currentMark = picker.querySelector("[data-ascii-mark]");

    function closeMenu() {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }

    function applyStyle(value, { save = true } = {}) {
      const style = ASCII_STYLES.find((item) => item.value === value);
      if (!style) return;

      document.documentElement.dataset.asciiStyle = style.value;
      currentLabel.textContent = style.label;
      currentMark.textContent = style.mark;

      picker.querySelectorAll("[data-ascii-option]").forEach((option) => {
        option.setAttribute(
          "aria-checked",
          String(option.dataset.asciiOption === style.value)
        );
      });

      if (save) {
        try {
          window.localStorage.setItem(ASCII_STORAGE_KEY, style.value);
        } catch {
          // The picker still works when storage is unavailable.
        }
      }

      window.dispatchEvent(new CustomEvent("site-ascii-change"));
    }

    trigger.addEventListener("click", () => {
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    picker.querySelectorAll("[data-ascii-option]").forEach((option) => {
      option.addEventListener("click", () => {
        applyStyle(option.dataset.asciiOption);
        closeMenu();
        trigger.focus();
      });
    });

    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) closeMenu();
    });
    picker.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        trigger.focus();
      }
    });

    applyStyle(readSavedAsciiStyle(), { save: false });
  }

  /* Decorative SVG fields */

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  function createSeededRandom(initialSeed) {
    let seed = initialSeed >>> 0;

    return () => {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initializeFieldGraphics(root = document) {
    root.querySelectorAll("[data-field]").forEach((svg, fieldIndex) => {
      if (svg.dataset.fieldReady === "true") return;

      const particleGroup = svg.querySelector("[data-field-particles]");
      if (!particleGroup) return;

      svg.dataset.fieldReady = "true";

      const center = 110;
      const radius = 91;
      const particleCount = 72;
      const linkCount = 21;
      const random = createSeededRandom(1701 + fieldIndex * 3571);
      const points = [];

      for (let index = 0; index < particleCount; index += 1) {
        const distance = Math.pow(random(), .68) * radius;
        const angle = random() * Math.PI * 2 + distance * .028;
        const wobble = 1 + .16 * Math.sin(angle * 3 + distance * .045);

        points.push({
          x: center + Math.cos(angle) * distance * wobble,
          y: center + Math.sin(angle) * distance * .62 / wobble
        });
      }

      const linkGroup = document.createElementNS(SVG_NAMESPACE, "g");
      linkGroup.setAttribute("aria-hidden", "true");

      for (let index = 0; index < linkCount; index += 1) {
        const firstIndex = Math.floor(random() * points.length);
        const secondIndex = (firstIndex + 1 + Math.floor(random() * 13)) % points.length;
        const first = points[firstIndex];
        const second = points[secondIndex];
        const line = document.createElementNS(SVG_NAMESPACE, "line");

        line.setAttribute("class", "field-link");
        line.setAttribute("x1", first.x.toFixed(2));
        line.setAttribute("y1", first.y.toFixed(2));
        line.setAttribute("x2", second.x.toFixed(2));
        line.setAttribute("y2", second.y.toFixed(2));
        linkGroup.append(line);
      }

      particleGroup.before(linkGroup);

      points.forEach((point, index) => {
        const particle = document.createElementNS(SVG_NAMESPACE, "circle");
        const isEmphasized = index % 29 === 0;

        particle.setAttribute("class", "field-particle");
        particle.setAttribute("cx", point.x.toFixed(2));
        particle.setAttribute("cy", point.y.toFixed(2));
        particle.setAttribute(
          "r",
          (isEmphasized ? 2.05 : .45 + random() * 1.05).toFixed(2)
        );
        particle.setAttribute(
          "opacity",
          (isEmphasized ? .72 : .16 + random() * .46).toFixed(2)
        );
        particleGroup.append(particle);
      });
    });
  }

  /* Expandable lists */

  const INITIAL_CARD_COUNT = 3;

  function initializeCardLists(root = document) {
    root.querySelectorAll("[data-card-list]").forEach((list) => {
      const cards = [...list.querySelectorAll(":scope > .content-card")];
      const button = list.parentElement?.querySelector(
        `[data-view-more][aria-controls="${list.id}"]`
      );

      if (!button) return;

      if (cards.length <= INITIAL_CARD_COUNT) {
        list.removeAttribute("data-expanded");
        button.hidden = true;
        return;
      }

      const label = button.querySelector("[data-view-more-label]");
      const icon = button.querySelector(".view-more-icon");
      const itemLabel = list.dataset.itemLabel || "items";
      const scrollRegion = list.closest(".content-list-region");

      function render(expanded) {
        list.dataset.expanded = String(expanded);
        if (!expanded && scrollRegion) scrollRegion.scrollTop = 0;
        button.setAttribute("aria-expanded", String(expanded));
        button.hidden = false;

        if (label) {
          label.textContent = expanded ? "Show less" : `View more ${itemLabel}`;
        }

        if (icon) {
          icon.textContent = expanded ? "↑" : "↓";
        }
      }

      render(false);
      button.addEventListener("click", () => {
        render(list.dataset.expanded !== "true");
      });
    });
  }

  /* Client-side navigation keeps the header and background mounted. */

  function initializeClientNavigation() {
    const navigationLinks = [
      ...document.querySelectorAll(".site-header nav a[href]")
    ];
    const pageCache = new Map();

    async function fetchPage(destination) {
      const cacheKey = destination.href;

      if (!pageCache.has(cacheKey)) {
        const request = window.fetch(cacheKey, {
          // Navigation pages are static; let the browser reuse the warmed copy.
          cache: "force-cache",
          headers: { Accept: "text/html" }
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Page request failed: ${response.status}`);
          }

          const html = await response.text();
          return new DOMParser().parseFromString(html, "text/html");
        });

        pageCache.set(cacheKey, request);
      }

      return pageCache.get(cacheKey);
    }

    function updateNavigation(nextDocument) {
      const nextLinks = [
        ...nextDocument.querySelectorAll(".site-header nav a[href]")
      ];

      navigationLinks.forEach((link, index) => {
        const nextLink = nextLinks[index];
        if (!nextLink) return;

        link.setAttribute("href", nextLink.getAttribute("href"));
        if (nextLink.getAttribute("aria-current") === "page") {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function updateDescription(nextDocument) {
      const nextDescription = nextDocument.querySelector('meta[name="description"]');
      const currentDescription = document.querySelector('meta[name="description"]');

      if (nextDescription && currentDescription) {
        currentDescription.setAttribute("content", nextDescription.content);
      }
    }

    function commitPage(nextDocument, destination, pushState) {
      const nextMain = nextDocument.querySelector("main");
      const currentMain = document.querySelector("main");
      if (!nextMain || !currentMain) return false;

      const importedMain = document.importNode(nextMain, true);
      let pageSwapped = false;

      function swapPage() {
        if (pageSwapped) return;
        pageSwapped = true;
        document.body.className = nextDocument.body.className;
        currentMain.replaceWith(importedMain);

        document.title = nextDocument.title;
        updateDescription(nextDocument);
        updateNavigation(nextDocument);

        if (pushState) {
          window.history.pushState({}, "", destination.href);
        }

        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        initializeFieldGraphics(document);
        initializeCardLists(document);
        window.dispatchEvent(new CustomEvent("site-route-change"));
      }

      function releaseRouteLock() {
        document.body.removeAttribute("aria-busy");
        delete document.body.dataset.routeLoading;
      }

      // Keep tab changes immediate; the persistent ASCII field continues
      // animating independently behind the newly mounted content.
      swapPage();
      releaseRouteLock();
      return true;
    }

    async function loadPage(destination, { pushState = true } = {}) {
      if (document.body.dataset.routeLoading === "true") return;

      document.body.dataset.routeLoading = "true";
      document.body.setAttribute("aria-busy", "true");

      try {
        const nextDocument = await fetchPage(destination);
        if (!commitPage(nextDocument, destination, pushState)) {
          window.location.assign(destination.href);
        }
      } catch {
        window.location.assign(destination.href);
      }
    }

    function prefetch(link) {
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname) return;
      fetchPage(destination).catch(() => {});
    }

    navigationLinks.forEach((link) => {
      link.addEventListener("pointerenter", () => prefetch(link), { once: true });
      link.addEventListener("focus", () => prefetch(link), { once: true });
      link.addEventListener("touchstart", () => prefetch(link), {
        once: true,
        passive: true
      });

      link.addEventListener("click", (event) => {
        const isModifiedClick = event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey;

        if (
          event.defaultPrevented
          || event.button !== 0
          || isModifiedClick
          || link.getAttribute("aria-current") === "page"
        ) {
          return;
        }

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;

        event.preventDefault();
        loadPage(destination);
      });

      // The pages are tiny; warming them here makes every tab switch immediate.
      prefetch(link);
    });

    window.addEventListener("popstate", () => {
      loadPage(new URL(window.location.href), { pushState: false });
    });
  }

  /* Startup */

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  initializeTheme();
  initializeAsciiPicker();
  initializeFieldGraphics();
  initializeCardLists();
  initializeClientNavigation();
})();
