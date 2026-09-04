/* Filter the shorties grid as the reader types, hiding categories that end up
   with nothing left in them. */
(() => {
  "use strict";

  const input = document.querySelector("[data-shorty-search]");
  if (!input) return;

  const sections = [...document.querySelectorAll("[data-shorty-section]")];
  const status = document.querySelector("[data-shorty-status]");

  function filter() {
    const query = input.value.trim().toLowerCase();
    let matches = 0;

    for (const section of sections) {
      let visible = 0;
      for (const card of section.querySelectorAll("[data-shorty-card]")) {
        const hit = !query || card.textContent.toLowerCase().includes(query);
        card.hidden = !hit;
        if (hit) visible += 1;
      }
      section.hidden = visible === 0;
      matches += visible;
    }

    if (status) {
      status.textContent = query
        ? `${matches} ${matches === 1 ? "entry" : "entries"} matching “${input.value.trim()}”`
        : "";
    }
  }

  input.addEventListener("input", filter);
  filter();
})();
