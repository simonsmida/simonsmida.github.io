/* Shared article navigation, generated from the rendered headings. */
(() => {
  'use strict';
  const article = document.querySelector('.article-content');
  const hero = document.querySelector('.article-header');
  const reader = document.querySelector('[data-article-reader]');
  if (!article || !hero || !reader) return;
  const list = reader.querySelector('ol');
  const progress = reader.querySelector('[role="progressbar"]');
  const desktop = matchMedia('(min-width: 1280px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const headings = [...article.querySelectorAll('h2, h3')].filter(h => h.textContent.trim());
  if (!headings.length) { reader.remove(); return; }
  const usedIds = new Set([...document.querySelectorAll('[id]')].map(el => el.id));
  const entries = headings.map((heading, i) => {
    if (!heading.id) {
      const base = heading.textContent.trim().toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || `section-${i + 1}`;
      let id = base, n = 2;
      while (usedIds.has(id)) id = `${base}-${n++}`;
      heading.id = id; usedIds.add(id);
    }
    const item = document.createElement('li');
    item.className = heading.tagName === 'H3' ? 'article-reader__subsection' : '';
    const link = document.createElement('a');
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = heading.textContent.trim();
    item.append(link); list.append(item);
    return { heading, link };
  });
  let scheduled = false, active = -1;
  function update() {
    scheduled = false;
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
    const top = Math.max(16, headerBottom + 24);
    reader.style.setProperty('--reader-top', `${top}px`);
    const bounds = article.getBoundingClientRect();
    const heroBottom = hero.getBoundingClientRect().bottom;
    const visible = heroBottom <= headerBottom && bounds.bottom > top;
    reader.classList.toggle('is-reading', visible);
    // Hidden desktop navigation is neither focusable nor exposed to AT.
    reader.inert = desktop.matches && !visible;
    const start = heroBottom + scrollY - headerBottom;
    const end = bounds.bottom + scrollY - innerHeight;
    const amount = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
    reader.style.setProperty('--reading-progress', amount);
    progress.setAttribute('aria-valuenow', String(Math.round(amount * 100)));
    let next = 0;
    entries.forEach(({ heading }, i) => { if (heading.getBoundingClientRect().top <= top + 16) next = i; });
    if (next !== active) {
      entries.forEach(({ link }, i) => {
        if (i === next) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      active = next;
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  function layout() {
    reader.open = desktop.matches;
    reader.querySelector('summary').tabIndex = desktop.matches ? -1 : 0;
    schedule();
  }
  reader.addEventListener('toggle', schedule);
  reader.querySelector('summary').addEventListener('click', event => {
    if (desktop.matches) event.preventDefault();
  });
  list.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const entry = entries.find(e => e.link === link);
    if (!entry) return;
    event.preventDefault();
    if (!desktop.matches) reader.open = false;
    history.pushState(null, '', link.getAttribute('href'));
    entry.heading.tabIndex = -1;
    entry.heading.focus({ preventScroll: true });
    entry.heading.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    schedule();
  });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', schedule);
  addEventListener('pageshow', schedule);
  desktop.addEventListener('change', layout);
  const observer = new ResizeObserver(schedule);
  observer.observe(hero); observer.observe(article);
  document.fonts.ready.then(schedule);
  layout();
})();
