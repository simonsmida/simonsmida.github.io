/*
 * Background field renderer.
 *
 * One fixed canvas paints a dithered glyph field behind the page. The work
 * per frame is deliberately cheap: every visible cell samples the active
 * variant once, gradients come from the neighbouring cells, and glyphs are
 * blitted from a pre-rendered atlas instead of being laid out as text.
 *
 * Readability zones quiet the field beneath text. Cards act as attractors in
 * that same field, bending existing glyphs into broad, root-like currents.
 */
(() => {
  "use strict";

  const FIELDS = window.SITE_FIELDS;
  const DEFAULT_FIELD = "manifold";
  const FRAME_INTERVAL = 1000 / 30;
  const FIELD_TIME_SCALE = .72;
  const TONES = 6;
  const KNEE = .62;
  const CARD_FLOOR = .26;
  const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ].map((value) => (value + .5) / 64);

  /* Text that must stay legible, with how much of the field survives beneath. */
  const ZONES = {
    "landing-page": [[".hero-copy", .14], [".hero-tab-panel-head", .2], [".hero-tab-more", .2]],
    "content-page": [[".page-intro", .14], [".view-more", .25]]
  };
  const CARD_SELECTOR = ".content-card";
  const SCROLL_CLIP_SELECTOR = ".hero-tab-list, .content-list-region, .mobile-tab-section-list";

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp01((value - edge0) / (edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
  };
  const mix = (a, b, amount) => a + (b - a) * amount;

  function parseRgb(value) {
    const channels = value.match(/[\d.]+/g);
    return channels && channels.length >= 3 ? channels.slice(0, 3).map(Number) : [110, 130, 150];
  }

  function rgbString([r, g, b]) {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  function mixRgb(a, b, amount) {
    return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)];
  }

  /* Signed distance to a rounded rectangle; negative inside. */
  function roundRectDistance(px, py, rect) {
    const radius = rect.radius;
    const halfW = (rect.right - rect.left) / 2 - radius;
    const halfH = (rect.bottom - rect.top) / 2 - radius;
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const qx = Math.abs(px - cx) - halfW;
    const qy = Math.abs(py - cy) - halfH;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    return outside + Math.min(Math.max(qx, qy), 0) - radius;
  }

  function currentFieldName() {
    const requested = document.documentElement.dataset.field;
    return FIELDS[requested] ? requested : DEFAULT_FIELD;
  }

  function createField(canvas) {
    const context = canvas.getContext("2d", { alpha: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* Viewport geometry, all in device pixels. */
    let dpr = 1;
    let width = 0;
    let height = 0;
    let cell = 1;
    let columns = 0;
    let rows = 0;
    let aspect = 1;

    /* Per-cell buffers. */
    let values = new Float32Array(0);
    let relief = new Float32Array(0);
    let mask = new Float32Array(0);

    /* Palette, atlas, layout. */
    let palette = null;
    let atlas = null;
    let atlasField = "";
    let zones = [];
    let sinks = [];
    let layoutDirty = true;
    let layoutSettleTimer = 0;

    /* Animation state. */
    let frame = 0;
    let lastPaint = 0;
    let lastTick = 0;

    /* ---- Palette and atlas ------------------------------------------------ */

    function readPalette() {
      const style = window.getComputedStyle(canvas);
      palette = {
        shadow: parseRgb(style.getPropertyValue("--field-shadow")),
        tone: parseRgb(style.getPropertyValue("--field-tone")),
        light: parseRgb(style.getPropertyValue("--field-light"))
      };
    }

    function toneColor(index) {
      const amount = index / (TONES - 1);
      return amount < .5
        ? mixRgb(palette.shadow, palette.tone, amount * 2)
        : mixRgb(palette.tone, palette.light, (amount - .5) * 2);
    }

    /* Each glyph is drawn once per tone into a sprite sheet. Lower glyph
       levels are fainter, so the ramp doubles as an alpha ramp. */
    function buildAtlas(glyphs, colorAt, alphaAt, fontScale = .95) {
      const sheet = document.createElement("canvas");
      sheet.width = cell * glyphs.length;
      sheet.height = cell * TONES;
      const sheetContext = sheet.getContext("2d");
      sheetContext.font = `500 ${Math.round(cell * fontScale)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      sheetContext.textAlign = "center";
      sheetContext.textBaseline = "middle";

      for (let tone = 0; tone < TONES; tone += 1) {
        sheetContext.fillStyle = rgbString(colorAt(tone));
        for (let level = 0; level < glyphs.length; level += 1) {
          sheetContext.globalAlpha = alphaAt(level, tone);
          sheetContext.fillText(glyphs[level], (level + .5) * cell, (tone + .5) * cell + cell * .04);
        }
      }
      return sheet;
    }

    function rebuildAtlases(field) {
      atlas = buildAtlas(
        field.glyphs,
        toneColor,
        (level, tone) => .45 + .55 * (level / (field.glyphs.length - 1)) * (.6 + .4 * tone / (TONES - 1))
      );
      atlasField = field;
    }

    /* ---- Geometry ------------------------------------------------------ */

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.round(window.innerWidth * dpr);
      height = Math.round(window.innerHeight * dpr);
      canvas.width = width;
      canvas.height = height;
      cell = Math.round((window.innerWidth < 700 ? 10 : 11) * dpr);
      columns = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      aspect = width / height;
      values = new Float32Array(columns * rows);
      relief = new Float32Array(columns * rows);
      mask = new Float32Array(columns * rows);
      readPalette();
      atlasField = "";
      layoutDirty = true;
    }

    function invalidateLayout() {
      layoutDirty = true;
      /* Panels animate into place; read the settled positions a beat later. */
      window.clearTimeout(layoutSettleTimer);
      layoutSettleTimer = window.setTimeout(() => { layoutDirty = true; }, 520);
    }

    function deviceRect(rect, clip) {
      const top = Math.max(rect.top, clip ? clip.top : rect.top);
      const bottom = Math.min(rect.bottom, clip ? clip.bottom : rect.bottom);
      if (!rect.width || bottom - top < 12) return null;
      return {
        left: rect.left * dpr,
        right: rect.right * dpr,
        top: top * dpr,
        bottom: bottom * dpr
      };
    }

    /* Line boxes rather than block boxes: the field then flows through the
       ragged edge of a paragraph instead of avoiding the whole column. */
    function textRects(element) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 4 && rect.height > 4);
      range.detach?.();
      return rects.length ? rects : [element.getBoundingClientRect()];
    }

    function readLayout() {
      const pageKind = Object.keys(ZONES).find((kind) => document.body.classList.contains(kind));
      zones = (ZONES[pageKind] || []).flatMap(([selector, floor]) => (
        [...document.querySelectorAll(selector)].flatMap((element) => (
          textRects(element).flatMap((line) => {
            const rect = deviceRect(line);
            return rect ? [{ ...rect, floor, radius: 10 * dpr, feather: 96 * dpr }] : [];
          })
        ))
      ));

      const previous = new Map(sinks.map((sink) => [sink.element, sink]));
      sinks = [...document.querySelectorAll(CARD_SELECTOR)].flatMap((element, index) => {
        const clip = element.closest(SCROLL_CLIP_SELECTOR)?.getBoundingClientRect();
        const rect = deviceRect(element.getBoundingClientRect(), clip);
        if (!rect) return [];
        const radius = Math.min(14 * dpr, (rect.bottom - rect.top) / 2);
        /* Feed each card from whichever side has the most open space. The
           roots terminate throughout the middle band instead of one point. */
        const fromLeft = rect.left >= width - rect.right;
        return [{
          ...rect,
          radius,
          element,
          hover: previous.get(element)?.hover || 0,
          phase: previous.get(element)?.phase ?? index * 1.37,
          seed: previous.get(element)?.seed ?? index * 1.91 + .7,
          fromLeft,
          edgeX: fromLeft ? rect.left : rect.right,
          reach: Math.min(480 * dpr, Math.max(230 * dpr, fromLeft ? rect.left : width - rect.right))
        }];
      });

      const headerBottom = (document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0) * dpr;
      const footerTop = (document.querySelector("footer")?.getBoundingClientRect().top || window.innerHeight) * dpr;

      for (let row = 0; row < rows; row += 1) {
        const py = (row + .5) * cell;
        const edgeFade = smoothstep(headerBottom - 30 * dpr, headerBottom + 40 * dpr, py)
          * (1 - smoothstep(footerTop - 40 * dpr, footerTop + 20 * dpr, py));
        for (let column = 0; column < columns; column += 1) {
          const px = (column + .5) * cell;
          let visible = edgeFade;
          for (const zone of zones) {
            const distance = roundRectDistance(px, py, zone);
            /* Squared falloff: quiet right beside the text, and no visible
               seam where the zone ends. */
            const away = smoothstep(0, zone.feather, distance);
            visible *= mix(zone.floor, 1, away * away);
          }
          for (const sink of sinks) {
            const distance = roundRectDistance(px, py, sink);
            /* Cards keep a faint field behind their translucent surface, so
               the composition stays continuous instead of punching a hole. */
            visible *= mix(CARD_FLOOR, 1, smoothstep(-2 * dpr, 26 * dpr, distance));
          }
          mask[row * columns + column] = visible;
        }
      }
      layoutDirty = false;
    }

    /* ---- Card attraction ------------------------------------------------- */

    function updateAttractors(dt) {
      for (const sink of sinks) {
        const active = sink.element.matches(":hover, :focus-within") ? 1 : 0;
        sink.hover += (active - sink.hover) * Math.min(1, dt * 2.1);
        sink.phase += dt * (.18 + sink.hover * .045);
      }
    }

    function rootPathY(sink, progress) {
      const center = (sink.top + sink.bottom) / 2;
      const amplitude = Math.min(72 * dpr, sink.reach * .14);
      const taper = 1 - progress;
      return center
        + Math.sin(progress * Math.PI * 1.24 + sink.seed) * amplitude * taper
        + Math.sin(progress * Math.PI * 3.1 - sink.seed * .7) * amplitude * .24 * taper;
    }

    /* Existing field cells are displaced along this curved vector field. The
       root remains broad at the card, so it feeds a middle band rather than a
       single inlet. No extra glyphs or particle layer are created. */
    function attractionAt(px, py) {
      let strongest = null;

      for (const sink of sinks) {
        const cardWidth = sink.right - sink.left;
        const cardHeight = sink.bottom - sink.top;
        const depth = Math.min(44 * dpr, cardWidth * .075);
        const targetX = sink.fromLeft ? sink.left + depth : sink.right - depth;
        const sourceX = sink.fromLeft
          ? Math.max(0, sink.edgeX - sink.reach)
          : Math.min(width, sink.edgeX + sink.reach);
        const spanX = targetX - sourceX;
        if (Math.abs(spanX) < 1) continue;

        const rawProgress = (px - sourceX) / spanX;
        if (rawProgress < -.04 || rawProgress > 1.06) continue;
        const progress = clamp01(rawProgress);
        const pathY = rootPathY(sink, progress);
        const rootWidth = mix(
          Math.min(86 * dpr, cardHeight * .82),
          Math.max(20 * dpr, cardHeight * .22),
          progress
        );
        const lane = (py - pathY) / Math.max(1, rootWidth);
        const strength = Math.exp(-lane * lane * 2.25)
          * smoothstep(0, .14, progress);
        if (strength < .012) continue;

        const before = rootPathY(sink, Math.max(0, progress - .012));
        const after = rootPathY(sink, Math.min(1, progress + .012));
        const tangentX = spanX * .024;
        const tangentY = after - before;
        const tangentLength = Math.hypot(tangentX, tangentY) || 1;
        const pulse = ((progress * 4.2 - sink.phase + sink.seed) % 1 + 1) % 1;
        const transport = strength * (.26 + pulse * .74);
        const displacement = cell * (.34 + sink.hover * .16) * transport;
        const candidate = {
          strength,
          hover: sink.hover,
          progress,
          dx: tangentX / tangentLength * displacement,
          dy: tangentY / tangentLength * displacement,
          salience: strength
            * (.2 + sink.hover * .5)
            * (.55 + progress * .45)
        };

        if (!strongest || candidate.strength > strongest.strength) {
          strongest = candidate;
        }
      }

      return strongest || { strength: 0, hover: 0, progress: 0, dx: 0, dy: 0, salience: 0 };
    }

    /* ---- Field ----------------------------------------------------------- */

    function sampleField(field, time) {
      const scale = 1 / height;
      const out = { value: values, relief };
      for (let row = 0; row < rows; row += 1) {
        const y = (row + .5) * cell * scale;
        for (let column = 0; column < columns; column += 1) {
          field.sample((column + .5) * cell * scale, y, time, out, row * columns + column, aspect);
        }
      }
    }

    /* Halo of attraction around a card: the field brightens in a ring just
       outside the card so the eye is led to it, more strongly on hover. */
    function haloAt(px, py) {
      let halo = 0;
      for (const sink of sinks) {
        const distance = roundRectDistance(px, py, sink);
        if (distance < 0 || distance > 120 * dpr) continue;
        const ring = smoothstep(0, 22 * dpr, distance) * (1 - smoothstep(30 * dpr, 120 * dpr, distance));
        halo = Math.max(halo, ring * (.08 + sink.hover * .34));
      }
      return halo;
    }

    function drawField(field, time) {
      const lightX = Math.cos(time * .11);
      const lightY = Math.sin(time * .11);
      const levels = field.glyphs.length;
      const halos = sinks.length > 0;

      for (let row = 0; row < rows; row += 1) {
        const up = Math.max(0, row - 1) * columns;
        const down = Math.min(rows - 1, row + 1) * columns;
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const visible = mask[index];
          if (visible < .02) continue;

          const px = column * cell;
          const py = row * cell;
          const attraction = halos
            ? attractionAt(px + cell / 2, py + cell / 2)
            : { strength: 0, hover: 0, dx: 0, dy: 0, salience: 0 };
          const left = relief[row * columns + Math.max(0, column - 1)];
          const right = relief[row * columns + Math.min(columns - 1, column + 1)];
          const gx = right - left;
          const gy = relief[down + column] - relief[up + column];
          const shade = clamp01(.5 + (gx * lightX + gy * lightY) * field.lightGain);

          /* Lit slopes carry heavier glyphs as well as brighter tones. */
          let value = values[index] * (.65 + shade * .7);
          if (halos) value += haloAt(px + cell / 2, py + cell / 2);
          value *= visible * (1 + attraction.salience * .78);
          /* Soft knee: compress highlights so the heaviest glyphs stay rare
             and the field keeps a readable range of mid tones. */
          if (value > KNEE) value = KNEE + (value - KNEE) * .38;

          const threshold = BAYER[(row & 7) * 8 + (column & 7)];
          const level = Math.floor(Math.pow(value, .85) * levels + (threshold - .5) * .9);
          if (level < 1) continue;

          const tone = Math.min(
            TONES - 1,
            Math.floor(clamp01(
              shade * .7 + value * .45 + attraction.salience * .2
            ) * TONES)
          );

          let glyph = Math.min(levels - 1, level - 1);
          if (field.directional) {
            /* The gradient direction chooses the stroke; the level only
               decides whether it is drawn light or heavy. */
            const octant = Math.round(Math.atan2(gy, gx) / (Math.PI / 4)) & 3;
            glyph = field.strokeOffsets[octant] + Math.min(1, level >> 2);
          }

          context.drawImage(
            atlas,
            glyph * cell,
            tone * cell,
            cell,
            cell,
            Math.round(px + attraction.dx),
            Math.round(py + attraction.dy),
            cell,
            cell
          );
        }
      }
    }

    function paint(time) {
      const field = FIELDS[currentFieldName()];
      if (atlasField !== field) rebuildAtlases(field);

      sampleField(field, time);
      context.clearRect(0, 0, width, height);
      drawField(field, time);
    }

    /* ---- Loop ------------------------------------------------------------ */

    function tick(timestamp) {
      frame = window.requestAnimationFrame(tick);
      if (timestamp - lastPaint < FRAME_INTERVAL) return;
      const dt = Math.min(.1, (timestamp - lastTick) / 1000);
      lastTick = timestamp;
      lastPaint = timestamp;
      if (layoutDirty) readLayout();
      updateAttractors(dt);
      paint(timestamp / 1000 * FIELD_TIME_SCALE);
    }

    function start() {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) {
        if (layoutDirty) readLayout();
        paint(0);
        return;
      }
      lastTick = performance.now();
      frame = window.requestAnimationFrame(tick);
    }

    function stop() {
      window.cancelAnimationFrame(frame);
    }

    return { resize, start, stop, invalidateLayout, readPalette, rebuild: () => { atlasField = ""; } };
  }

  function initialize() {
    const canvas = document.querySelector("[data-field-canvas]");
    if (!canvas || !FIELDS) return;

    const field = createField(canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let resizeTimer = 0;

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { field.resize(); field.start(); }, 120);
    }, { passive: true });
    document.addEventListener("scroll", field.invalidateLayout, { passive: true, capture: true });
    window.addEventListener("site-layout-change", field.invalidateLayout);
    window.addEventListener("site-theme-change", () => { field.readPalette(); field.rebuild(); field.start(); });
    window.addEventListener("site-field-change", field.start);
    reducedMotion.addEventListener("change", field.start);
    document.addEventListener("visibilitychange", () => (document.hidden ? field.stop() : field.start()));

    field.resize();
    field.start();
  }

  initialize();
})();
