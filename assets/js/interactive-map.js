(function () {
  const regionTags = new Set([
    "a",
    "circle",
    "ellipse",
    "g",
    "path",
    "polygon",
    "polyline",
    "rect"
  ]);

  const structuralId = /^(defs|image|layer|svg)\d*$/i;

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function humanizeId(id) {
    return id
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  function isRegionCandidate(element) {
    const id = element.id || "";
    const tagName = element.tagName.toLowerCase();

    if (!id || structuralId.test(id) || !regionTags.has(tagName)) {
      return false;
    }

    if ((tagName === "a" || tagName === "g") && !element.querySelector("path, rect, circle, ellipse, polygon, polyline")) {
      return false;
    }

    return true;
  }

  function getMapScope(map) {
    return map.closest(".page__content") || document;
  }

  function getIgnoredRegionIds(map) {
    return new Set(
      (map.getAttribute("data-map-ignore") || "")
        .split(",")
        .map(function (id) {
          return id.trim();
        })
        .filter(Boolean)
    );
  }

  function findSection(map, regionId) {
    const scope = getMapScope(map);
    const sections = scope.querySelectorAll("[data-map-section]");

    for (const section of sections) {
      if (section.getAttribute("data-map-section") === regionId) {
        return section;
      }
    }

    return null;
  }

  function scrollToSection(section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    if (section.id) {
      history.replaceState(null, "", "#" + section.id);
    }
  }

  function disableExternalSvgLinks(svg) {
    svg.querySelectorAll("a").forEach(function (link) {
      link.removeAttribute("href");
      link.removeAttribute("xlink:href");
      link.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    });
  }

  function makeClickable(region, target) {
    const label = humanizeId(region.id);

    region.setAttribute("data-map-region", region.id);
    region.setAttribute("role", "link");
    region.setAttribute("tabindex", "0");
    region.setAttribute("aria-label", "Jump to " + label);
    region.setAttribute("title", "Jump to " + label);

    region.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      scrollToSection(target);
    });

    region.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scrollToSection(target);
      }
    });
  }

  function markDisabled(region) {
    region.setAttribute("data-map-disabled", "true");
    region.setAttribute("aria-disabled", "true");
  }

  function renderTodoTable(map, missingRegions) {
    if (!missingRegions.length || map.getAttribute("data-map-todo") === "false") {
      return;
    }

    const details = document.createElement("details");
    details.className = "interactive-map__todo";

    const rows = missingRegions
      .map(function (id) {
        return [
          "<tr>",
          "<td><code>" + escapeHTML(id) + "</code></td>",
          "<td>TODO: add an article element with <code>data-map-section=\"" + escapeHTML(id) + "\"</code>, or treat this SVG ID as an internal drawing path.</td>",
          "</tr>"
        ].join("");
      })
      .join("");

    details.innerHTML = [
      "<summary>Unmapped SVG regions</summary>",
      "<table>",
      "<thead><tr><th>SVG ID</th><th>Needed mapping</th></tr></thead>",
      "<tbody>",
      rows,
      "</tbody>",
      "</table>"
    ].join("");

    map.insertAdjacentElement("afterend", details);
  }

  function wireMap(map, svg) {
    const missingRegions = [];
    const elementsWithIds = Array.from(svg.querySelectorAll("[id]"));
    const ignoredRegionIds = getIgnoredRegionIds(map);

    elementsWithIds.forEach(function (element) {
      if (element.closest("[data-map-region]") || !isRegionCandidate(element)) {
        return;
      }

      if (ignoredRegionIds.has(element.id)) {
        return;
      }

      const target = findSection(map, element.id);

      if (target) {
        makeClickable(element, target);
      } else {
        markDisabled(element);
        missingRegions.push(element.id);
      }
    });

    renderTodoTable(map, missingRegions);
  }

  async function hydrateMap(map) {
    const src = map.getAttribute("data-map-src");

    if (!src) {
      return;
    }

    try {
      const response = await fetch(src, { credentials: "same-origin" });

      if (!response.ok) {
        throw new Error("Could not load SVG: " + response.status);
      }

      const svgText = await response.text();
      const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const parserError = svgDocument.querySelector("parsererror");
      const svg = svgDocument.querySelector("svg");

      if (parserError || !svg) {
        throw new Error("Could not parse SVG.");
      }

      disableExternalSvgLinks(svg);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", map.getAttribute("aria-label") || "Interactive map");
      map.replaceChildren(document.importNode(svg, true));
      wireMap(map, map.querySelector("svg"));
    } catch (error) {
      map.innerHTML = "<p class=\"interactive-map__error\">Interactive map could not be loaded. <a href=\"" + escapeHTML(src) + "\">Open the SVG directly</a>.</p>";
      console.error(error);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-interactive-map]").forEach(hydrateMap);
  });
})();
