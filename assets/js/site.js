(() => {
  "use strict";

  /* Theme */

  const THEME_STORAGE_KEY = "simon-site-palette";
  const LIGHT_THEME = "slate-blue";
  const DARK_THEME = "midnight-navy";
  const THEMES = new Set([LIGHT_THEME, DARK_THEME]);
  // Below this width the inline About + cards layout becomes cramped.
  const COMPACT_LAYOUT_QUERY = "(max-width: 1100px)";

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

  function updateFavicon(theme) {
    document.querySelectorAll("[data-theme-favicon]").forEach((currentLink) => {
      const nextHref = theme === DARK_THEME
        ? currentLink.dataset.darkHref
        : currentLink.dataset.lightHref;
      if (!nextHref || currentLink.getAttribute("href") === nextHref) return;

      // Replacing the node prompts Safari/WebKit to repaint the favicon now.
      const nextLink = currentLink.cloneNode(true);
      nextLink.setAttribute("href", nextHref);
      currentLink.replaceWith(nextLink);
    });
  }

  function applyTheme(theme, { save = true } = {}) {
    if (!THEMES.has(theme)) return;

    document.documentElement.dataset.theme = theme;
    updateThemeButton(theme);
    updateFavicon(theme);

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

  /* Match a selected article thumbnail to its destination hero. Browsers that
     do not support cross-document View Transitions simply ignore the name. */
  function initializeSharedArticleTransitions() {
    function clearTransitionNames() {
      document.querySelectorAll("[data-view-transition-name]").forEach((media) => {
        media.style.removeProperty("view-transition-name");
      });
    }

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest(".content-card a[href]");
      const card = link?.closest(".content-card");
      const media = card?.querySelector("[data-view-transition-name]");
      const isModifiedClick = event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey;

      if (!media || event.button !== 0 || isModifiedClick) return;
      clearTransitionNames();
      media.style.viewTransitionName = media.dataset.viewTransitionName;
    });

    window.addEventListener("pageshow", clearTransitionNames);
  }

  /* Client-side navigation keeps the header and background mounted. */

  function initializeClientNavigation() {
    const navigationLinks = [
      ...document.querySelectorAll(".site-header nav a[href]")
    ];
    const pageCache = new Map();
    const navigation = document.querySelector(".site-header nav");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let navigationIndicator = null;

    function syncNavigationIndicator({ initial = false } = {}) {
      if (!navigation || !navigationIndicator) return;

      const activeLink = navigationLinks.find((link) => (
        link.getAttribute("aria-current") === "page" && link.offsetWidth > 0
      ));

      if (!activeLink) {
        navigationIndicator.classList.remove("is-ready");
        return;
      }

      const navigationRect = navigation.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const overhang = 3;

      navigation.style.setProperty(
        "--nav-indicator-x",
        `${linkRect.left - navigationRect.left - overhang}px`
      );
      navigation.style.setProperty(
        "--nav-indicator-width",
        `${linkRect.width + overhang * 2}px`
      );

      if (initial) {
        requestAnimationFrame(() => navigationIndicator?.classList.add("is-ready"));
      } else {
        navigationIndicator.classList.add("is-ready");
      }
    }

    function initializeNavigationIndicator() {
      if (!navigation) return;

      navigationIndicator = document.createElement("span");
      navigationIndicator.className = "site-nav-indicator";
      navigationIndicator.setAttribute("aria-hidden", "true");
      navigation.append(navigationIndicator);
      navigation.classList.add("has-motion-indicator");
      syncNavigationIndicator({ initial: true });
    }

    async function fetchPage(destination) {
      const cacheKey = destination.href;

      if (!pageCache.has(cacheKey)) {
        const request = window.fetch(cacheKey, {
          // Revalidate the warmed copy so a route never restores stale chrome
          // (especially the footer/canvas) after a deploy or back navigation.
          cache: "no-cache",
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

      syncNavigationIndicator();
      requestAnimationFrame(() => syncNavigationIndicator());
    }

    function updateDescription(nextDocument) {
      const nextDescription = nextDocument.querySelector('meta[name="description"]');
      const currentDescription = document.querySelector('meta[name="description"]');

      if (nextDescription && currentDescription) {
        currentDescription.setAttribute("content", nextDescription.content);
      }
    }

    function isHomeRoute(pathname) {
      return pathname.endsWith("/") || pathname.endsWith("/index.html");
    }

    // Landing-page tabs are views of the same shell. Keep that state in the
    // hash so a refresh restores the inline panel instead of opening the full index.
    function inlineDestinationFromUrl(url) {
      if (!isHomeRoute(url.pathname) || !url.hash) return null;

      const route = url.hash
        .slice(1)
        .replace(/^\//, "")
        .replace(/\.html$/, "");
      if (!["research", "writing", "projects"].includes(route)) return null;

      return new URL(`/${route}.html`, url.origin);
    }

    function landingHistoryUrl(destination) {
      const url = new URL(window.location.href);
      if (isHomeRoute(destination.pathname)) {
        url.hash = "";
        url.search = "";
        return url.href;
      }

      url.hash = `#${destination.pathname.replace(/^\//, "").replace(/\.html$/, "")}`;
      url.search = "";
      return url.href;
    }

    function importCards(nextDocument, destination, limit = 3) {
      return [...nextDocument.querySelectorAll(".content-card")]
        .slice(0, limit)
        .map((sourceCard) => {
          const card = document.importNode(sourceCard, true);

          card.querySelectorAll("[href], [src]").forEach((element) => {
            ["href", "src"].forEach((attribute) => {
              const value = element.getAttribute(attribute);
              if (!value || value.startsWith("#") || value.startsWith("data:")) return;

              try {
                element.setAttribute(attribute, new URL(value, destination.href).href);
              } catch {
                // Keep the original URL if an unusual content URL cannot resolve.
              }
            });
          });

          card.querySelectorAll("img").forEach((image) => {
            image.loading = "eager";
            image.decoding = "async";
          });

          return card;
        });
    }

    // Keep the fixed chrome in sync when a full page shell is swapped in place.
    // Article pages have a different footer and do not ship the ASCII canvas,
    // so leaving either element mounted would leak article state into About.
    function importChromeElement(source, destination) {
      const element = document.importNode(source, true);

      element.querySelectorAll("[href], [src]").forEach((node) => {
        ["href", "src"].forEach((attribute) => {
          const value = node.getAttribute(attribute);
          if (!value || value.startsWith("#") || value.startsWith("data:")) return;

          try {
            node.setAttribute(attribute, new URL(value, destination.href).href);
          } catch {
            // Keep the original URL if an unusual asset URL cannot resolve.
          }
        });
      });

      return element;
    }

    function syncPageChrome(nextDocument, destination) {
      const header = document.querySelector(".site-header");
      const nextSiteMark = nextDocument.querySelector(".site-mark");
      const currentSiteMark = document.querySelector(".site-mark");

      if (nextSiteMark && currentSiteMark) {
        currentSiteMark.replaceWith(importChromeElement(nextSiteMark, destination));
      } else if (nextSiteMark && header) {
        header.prepend(importChromeElement(nextSiteMark, destination));
      } else {
        currentSiteMark?.remove();
      }

      const nextFooter = nextDocument.querySelector("footer");
      const currentFooter = document.querySelector("footer");
      if (nextFooter && currentFooter) {
        currentFooter.replaceWith(importChromeElement(nextFooter, destination));
      }

      // Keep a mounted canvas alive while navigating so its animation does not
      // restart. Direct article loads have no canvas, so restore it when the
      // next shell requires one and load the field script once.
      const nextCanvas = nextDocument.querySelector("[data-ascii-manifold]");
      const currentCanvas = document.querySelector("[data-ascii-manifold]");
      if (!nextCanvas) return;

      if (currentCanvas) {
        return;
      }

      const importedCanvas = document.importNode(nextCanvas, true);
      document.body.insertBefore(importedCanvas, header || document.body.firstChild);

      const asciiScript = [...nextDocument.scripts].find((script) => (
        script.src.includes("/ascii-field.js")
      ));
      if (!asciiScript || document.querySelector('script[src*="/ascii-field.js"]')) {
        window.initializeAsciiField?.();
        return;
      }

      const script = document.createElement("script");
      script.src = new URL(asciiScript.getAttribute("src"), destination.href).href;
      script.defer = true;
      document.body.append(script);
    }

    function updateInlineShell(nextDocument, destination) {
      const panel = document.querySelector("[data-inline-panel]");
      const list = panel?.querySelector("[data-inline-list]");
      const title = panel?.querySelector("[data-inline-title]");
      const more = panel?.querySelector("[data-inline-more]");
      if (!panel || !list || !title || !more) return false;

      if (isHomeRoute(destination.pathname)) {
        document.body.classList.remove("inline-content-active");
        panel.hidden = true;
        list.replaceChildren();
        list.removeAttribute("data-motion");
        more.hidden = true;
        return true;
      }

      const sourceTitle = nextDocument.querySelector(".page-intro h1");
      // Keep the inline panel compact, but let its card field reveal the full collection.
      const cards = importCards(nextDocument, destination, Number.POSITIVE_INFINITY);
      if (!cards.length || !sourceTitle) return false;

      cards.forEach((card, index) => {
        card.style.setProperty("--card-index", index);
      });

      title.textContent = sourceTitle.textContent;
      list.replaceChildren(...cards);
      if (reducedMotion.matches) list.removeAttribute("data-motion");
      else list.dataset.motion = "entering";
      more.href = destination.href;
      more.textContent = `View all ${sourceTitle.textContent.toLowerCase()} ↗`;
      more.hidden = false;
      document.body.classList.add("inline-content-active");
      panel.hidden = false;
      return true;
    }

    function waitForPanelExit(panel) {
      if (reducedMotion.matches || panel.hidden) return Promise.resolve();

      panel.dataset.motion = "leaving";
      return new Promise((resolve) => {
        let settled = false;

        function finish() {
          if (settled) return;
          settled = true;
          panel.removeEventListener("transitionend", handleTransitionEnd);
          resolve();
        }

        function handleTransitionEnd(event) {
          if (event.target === panel && event.propertyName === "opacity") finish();
        }

        panel.addEventListener("transitionend", handleTransitionEnd);
        window.setTimeout(finish, 170);
      });
    }

    async function commitInlineShell(nextDocument, destination, pushState) {
      const panel = document.querySelector("[data-inline-panel]");
      const list = panel?.querySelector("[data-inline-list]");
      if (!panel || !list) return false;

      const incomingPanel = !isHomeRoute(destination.pathname);
      const panelAlreadyVisible = document.body.classList.contains("inline-content-active");
      const crossingPanelBoundary = incomingPanel !== panelAlreadyVisible;

      // Keep the panel mounted while moving between content sections. The
      // cards can re-enter independently, while the View all link stays in
      // place and simply updates its destination and label.
      if (crossingPanelBoundary) {
        await waitForPanelExit(panel);
      }

      if (crossingPanelBoundary && incomingPanel && !reducedMotion.matches) {
        panel.dataset.motion = "entering";
      }

      if (!updateInlineShell(nextDocument, destination)) {
        delete panel.dataset.motion;
        return false;
      }

      document.title = nextDocument.title;
      updateDescription(nextDocument);
      updateNavigation(nextDocument);

      if (pushState) {
        window.history.pushState({}, "", landingHistoryUrl(destination));
      }

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.dispatchEvent(new CustomEvent("site-route-change"));

      if (crossingPanelBoundary && incomingPanel && !reducedMotion.matches) {
        // Commit the starting state before allowing the panel to settle.
        panel.getBoundingClientRect();
        requestAnimationFrame(() => delete panel.dataset.motion);
        window.setTimeout(() => list.removeAttribute("data-motion"), 440);
      } else {
        delete panel.dataset.motion;
      }

      return true;
    }

    function updateMobileNavigation(pathname) {
      navigationLinks.forEach((link) => {
        const linkPath = new URL(link.href, window.location.href).pathname;
        const current = isHomeRoute(pathname)
          ? isHomeRoute(linkPath)
          : linkPath === pathname;

        if (current) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      syncNavigationIndicator();
      requestAnimationFrame(() => syncNavigationIndicator());
    }

    function initializeMobileSections() {
      const sectionRoot = document.querySelector("[data-mobile-sections]");
      if (!sectionRoot || !document.body.classList.contains("landing-page")) {
        return Promise.resolve(false);
      }

      const destinations = navigationLinks
        .map((link) => new URL(link.href, window.location.href))
        .filter((destination) => destination.origin === window.location.origin)
        .filter((destination) => !isHomeRoute(destination.pathname));

      return Promise.all(destinations.map(async (destination) => ({
        destination,
        document: await fetchPage(destination)
      }))).then((sections) => {
        sections.forEach(({ destination, document: sourceDocument }) => {
          const cards = importCards(sourceDocument, destination);
          const sourceTitle = sourceDocument.querySelector(".page-intro h1");
          if (!cards.length || !sourceTitle) return;

          const section = document.createElement("section");
          section.className = "mobile-tab-section";
          section.dataset.mobileRoute = destination.pathname;
          section.dataset.mobileTitle = sourceTitle.textContent;
          section.setAttribute("aria-labelledby", `mobile-${sourceTitle.textContent.toLowerCase()}-title`);

          const inner = document.createElement("div");
          inner.className = "mobile-tab-section-inner";

          const heading = document.createElement("h2");
          heading.id = `mobile-${sourceTitle.textContent.toLowerCase()}-title`;
          heading.textContent = sourceTitle.textContent;
          inner.append(heading);

          const list = document.createElement("div");
          list.className = "mobile-tab-section-list";
          cards.forEach((card) => list.append(card));
          inner.append(list);
          section.append(inner);
          sectionRoot.append(section);
        });

        const hero = document.querySelector(".hero[data-mobile-route]");
        const observedSections = [hero, ...sectionRoot.querySelectorAll(".mobile-tab-section")]
          .filter(Boolean);

        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver((entries) => {
            if (!window.matchMedia(COMPACT_LAYOUT_QUERY).matches) return;

            const visible = entries
              .filter((entry) => entry.isIntersecting)
              .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
            if (!visible) return;

            const pathname = visible.target.dataset.mobileRoute;
            const isHome = isHomeRoute(pathname);
            document.body.classList.toggle("inline-content-active", !isHome);
            updateMobileNavigation(pathname);
          }, { threshold: [.55, .8] });

          observedSections.forEach((section) => observer.observe(section));
        }

        return true;
      }).catch(() => false);
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
        syncPageChrome(nextDocument, destination);

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
        const useInlineShell = document.body.classList.contains("landing-page");
        const committed = useInlineShell
          ? await commitInlineShell(nextDocument, destination, pushState)
          : commitPage(nextDocument, destination, pushState);

        if (!committed) {
          window.location.assign(destination.href);
        } else if (useInlineShell) {
          document.body.removeAttribute("aria-busy");
          delete document.body.dataset.routeLoading;
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

    initializeNavigationIndicator();
    window.addEventListener("resize", () => {
      requestAnimationFrame(() => syncNavigationIndicator());
    }, { passive: true });

    const mobileSectionsReady = initializeMobileSections();

    function scrollToMobileRoute(
      destination,
      { pushState = true, behavior = "smooth" } = {}
    ) {
      if (!window.matchMedia(COMPACT_LAYOUT_QUERY).matches) return false;

      const hero = document.querySelector(".hero[data-mobile-route]");
      const sections = [hero, ...document.querySelectorAll(".mobile-tab-section")]
        .filter(Boolean);
      const target = sections.find((section) => {
        return isHomeRoute(destination.pathname)
          ? isHomeRoute(section.dataset.mobileRoute)
          : section.dataset.mobileRoute === destination.pathname;
      });
      if (!target) return false;

      const isHome = isHomeRoute(destination.pathname);
      document.body.classList.toggle("inline-content-active", !isHome);
      updateMobileNavigation(destination.pathname);
      if (pushState) {
        window.history.pushState({}, "", landingHistoryUrl(destination));
      }
      target.scrollIntoView({ behavior, block: "start" });
      return true;
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

        if (
          document.body.classList.contains("landing-page")
          && window.matchMedia(COMPACT_LAYOUT_QUERY).matches
        ) {
          event.preventDefault();
          mobileSectionsReady.then(() => {
            if (!scrollToMobileRoute(destination)) loadPage(destination);
          });
          return;
        }

        event.preventDefault();
        loadPage(destination);
      });

      // The pages are tiny; warming them here makes every tab switch immediate.
      prefetch(link);
    });

    const initialInlineDestination = inlineDestinationFromUrl(
      new URL(window.location.href)
    );
    if (initialInlineDestination) {
      mobileSectionsReady.then(() => {
        if (window.matchMedia(COMPACT_LAYOUT_QUERY).matches) {
          scrollToMobileRoute(initialInlineDestination, {
            pushState: false,
            behavior: "auto"
          });
        } else {
          loadPage(initialInlineDestination, { pushState: false });
        }
      });
    }

    window.addEventListener("popstate", () => {
      const destination = new URL(window.location.href);
      if (document.body.classList.contains("landing-page")) {
        const inlineDestination = inlineDestinationFromUrl(destination);
        if (inlineDestination) {
          if (window.matchMedia(COMPACT_LAYOUT_QUERY).matches) {
            mobileSectionsReady.then(() => scrollToMobileRoute(
              inlineDestination,
              { pushState: false }
            ));
          } else {
            loadPage(inlineDestination, { pushState: false });
          }
          return;
        }

        if (scrollToMobileRoute(destination, { pushState: false })) return;
      }
      loadPage(destination, { pushState: false });
    });
  }

  /* Startup */

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  initializeTheme();
  initializeFieldGraphics();
  initializeCardLists();
  initializeSharedArticleTransitions();
  initializeClientNavigation();
})();
