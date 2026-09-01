/*
 * Background field renderer.
 *
 * One fixed canvas paints a dithered glyph field behind the page. The work
 * per frame is deliberately cheap: every visible cell samples the active
 * variant once, gradients come from the neighbouring cells, and glyphs are
 * blitted from a pre-rendered atlas instead of being laid out as text.
 *
 * Two things sit on top of the field:
 *   – readability zones, which quiet the field under text and cards
 *   – streams, small particles that drift into the cards and feed them
 */
(() => {
  "use strict";

  const FIELDS = window.SITE_FIELDS;
  const DEFAULT_FIELD = "manifold";
  const FRAME_INTERVAL = 1000 / 30;
  const FIELD_TIME_SCALE = .72;
  const TONES = 6;
  const MAX_PARTICLES = 320;
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
    let streamAtlas = null;
    let streamGlyphs = [];
    let atlasField = "";
    let zones = [];
    let sinks = [];
    let layoutDirty = true;
    let layoutSettleTimer = 0;

    /* Animation state. */
    let frame = 0;
    let lastPaint = 0;
    let lastTick = 0;
    let particles = [];

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
      /* Streams are made from the active field's lighter glyphs and palette.
         They should look like the field being drawn inward, not a second,
         differently coloured particle effect. */
      streamGlyphs = field.directional
        ? ["·", ":", "-", "+", "*"]
        : field.glyphs.slice(0, Math.min(6, field.glyphs.length));
      streamAtlas = buildAtlas(
        streamGlyphs,
        toneColor,
        (level, tone) => .42
          + .34 * (level / Math.max(1, streamGlyphs.length - 1))
          + .24 * tone / (TONES - 1)
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
      sinks = [...document.querySelectorAll(CARD_SELECTOR)].flatMap((element) => {
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

    function maskAt(px, py) {
      const column = Math.min(columns - 1, Math.max(0, Math.floor(px / cell)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(py / cell)));
      return mask[row * columns + column];
    }

    /* ---- Streams --------------------------------------------------------- */

    /*
     * Each card draws a stream through an inlet on its open side. A particle is
     * born upstream and always moves toward that inlet, gaining speed and
     * brightness as it arrives. The flow is one-directional by construction:
     * losing hover only lowers the spawn rate and speed, so particles already
     * in flight finish their trip instead of drifting back.
     *
     * Spawning picks the most open of a few candidates in a wide cone pointing
     * away from the card, which lets a stream arrive diagonally when the card
     * has little room beside it.
     */
    function particleTarget(sink, particle) {
      const cardWidth = sink.right - sink.left;
      const depth = Math.min(44 * dpr, cardWidth * particle.depth);
      return {
        x: sink.fromLeft ? sink.left + depth : sink.right - depth,
        y: mix(sink.top, sink.bottom, particle.targetY)
      };
    }

    function spawnParticle(sink) {
      if (particles.length >= MAX_PARTICLES) return;
      const targetY = .28 + ((Math.random() + Math.random()) * .5) * .44;
      const depth = .045 + Math.random() * .045;
      const target = particleTarget(sink, { targetY, depth });
      const away = sink.fromLeft ? Math.PI : 0;
      let best = null;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const angle = away + (Math.random() - .5) * 1.2;
        const distance = sink.reach * (.55 + Math.random() * .45);
        const x = sink.edgeX + Math.cos(angle) * distance;
        const y = target.y + Math.sin(angle) * distance;
        if (x < 0 || y < 0 || x > width || y > height) continue;
        const openness = maskAt(x, y);
        if (!best || openness > best.openness) best = { x, y, openness };
        if (openness > .8) break;
      }
      if (!best) return;
      const { x, y } = best;

      particles.push({
        element: sink.element,
        x,
        y,
        targetY,
        depth,
        birthDistance: Math.hypot(target.x - x, target.y - y),
        age: 0,
        progress: 0,
        seed: Math.random() * 7,
        sway: .5 + Math.random()
      });
    }

    function updateStreams(dt, time) {
      for (const sink of sinks) {
        const active = sink.element.matches(":hover, :focus-within") ? 1 : 0;
        sink.hover += (active - sink.hover) * Math.min(1, dt * 2.2);
        const rate = (5 + sink.hover * 18) * dt;
        for (let spawn = rate; spawn > 0; spawn -= 1) {
          if (spawn >= 1 || Math.random() < spawn) spawnParticle(sink);
        }
      }

      /* Sinks are rebuilt whenever layout changes; particles follow their card. */
      const sinkByElement = new Map(sinks.map((sink) => [sink.element, sink]));
      particles = particles.filter((particle) => {
        const sink = sinkByElement.get(particle.element);
        if (!sink) return false;
        particle.sink = sink;

        const target = particleTarget(sink, particle);
        const dx = target.x - particle.x;
        const dy = target.y - particle.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 5 * dpr) return false;

        const progress = clamp01(1 - distance / Math.max(1, particle.birthDistance));
        const speed = (28 + sink.hover * 18) * dpr * (.58 + progress * .82);
        /* A lateral wave that decays on approach keeps the path alive but
           still converging, never sideways enough to stall the arrival. */
        const wave = Math.sin(time * .58 * particle.sway + particle.seed + progress * 4.2)
          * (1 - progress) * .34;
        const stepX = (dx / distance - (dy / distance) * wave) * speed * dt;
        const stepY = (dy / distance + (dx / distance) * wave) * speed * dt;

        particle.x += stepX;
        particle.y += stepY;
        particle.age += dt;
        particle.progress = progress;
        particle.headingX = stepX;
        particle.headingY = stepY;
        /* Rather than culling particles over text, fade them out there: a
           stream can then cross the page and only shows in open space. The
           final stretch into the inlet always stays visible. */
        const arrival = 1 - smoothstep(12 * dpr, 46 * dpr, distance);
        particle.clarity = Math.max(maskAt(particle.x, particle.y), arrival);

        return particle.x >= 0 && particle.y >= 0
          && particle.x <= width && particle.y <= height;
      });
    }

    /* Three fading echoes behind each glyph read as a soft root at 30fps. */
    function drawStreams() {
      for (const particle of particles) {
        const salience = clamp01(
          .18 + particle.progress * .42 + particle.sink.hover * .4
        );
        const level = Math.min(
          streamGlyphs.length - 1,
          Math.floor(salience * streamGlyphs.length)
        );
        const tone = Math.min(TONES - 1, Math.floor((.16 + salience * .7) * TONES));
        const fade = Math.min(1, particle.age * 2.5);
        const alpha = fade
          * particle.clarity
          * (.2 + particle.progress * .26 + particle.sink.hover * .34);
        if (alpha < .012) continue;
        const step = Math.hypot(particle.headingX, particle.headingY) || 1;
        const spacing = Math.min(9 * dpr, step * 2.2);
        const backX = (particle.headingX / step) * spacing;
        const backY = (particle.headingY / step) * spacing;

        for (let echo = 3; echo >= 0; echo -= 1) {
          context.globalAlpha = alpha * (echo === 0 ? 1 : .34 / echo);
          context.drawImage(
            streamAtlas, level * cell, tone * cell, cell, cell,
            Math.round(particle.x - backX * echo - cell / 2),
            Math.round(particle.y - backY * echo - cell / 2),
            cell, cell
          );
        }
      }
      context.globalAlpha = 1;
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
          const left = relief[row * columns + Math.max(0, column - 1)];
          const right = relief[row * columns + Math.min(columns - 1, column + 1)];
          const gx = right - left;
          const gy = relief[down + column] - relief[up + column];
          const shade = clamp01(.5 + (gx * lightX + gy * lightY) * field.lightGain);

          /* Lit slopes carry heavier glyphs as well as brighter tones. */
          let value = values[index] * (.65 + shade * .7);
          if (halos) value += haloAt(px + cell / 2, py + cell / 2);
          value *= visible;
          /* Soft knee: compress highlights so the heaviest glyphs stay rare
             and the field keeps a readable range of mid tones. */
          if (value > KNEE) value = KNEE + (value - KNEE) * .38;

          const threshold = BAYER[(row & 7) * 8 + (column & 7)];
          const level = Math.floor(Math.pow(value, .85) * levels + (threshold - .5) * .9);
          if (level < 1) continue;

          const tone = Math.min(TONES - 1, Math.floor(clamp01(shade * .7 + value * .45) * TONES));

          let glyph = Math.min(levels - 1, level - 1);
          if (field.directional) {
            /* The gradient direction chooses the stroke; the level only
               decides whether it is drawn light or heavy. */
            const octant = Math.round(Math.atan2(gy, gx) / (Math.PI / 4)) & 3;
            glyph = field.strokeOffsets[octant] + Math.min(1, level >> 2);
          }

          context.drawImage(atlas, glyph * cell, tone * cell, cell, cell, px, py, cell, cell);
        }
      }
    }

    function paint(time) {
      const field = FIELDS[currentFieldName()];
      if (atlasField !== field) rebuildAtlases(field);

      sampleField(field, time);
      context.clearRect(0, 0, width, height);
      drawField(field, time);
      drawStreams();
    }

    /* ---- Loop ------------------------------------------------------------ */

    function tick(timestamp) {
      frame = window.requestAnimationFrame(tick);
      if (timestamp - lastPaint < FRAME_INTERVAL) return;
      const dt = Math.min(.1, (timestamp - lastTick) / 1000);
      lastTick = timestamp;
      lastPaint = timestamp;
      if (layoutDirty) readLayout();
      updateStreams(dt, timestamp / 1000);
      paint(timestamp / 1000 * FIELD_TIME_SCALE);
    }

    function start() {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) {
        particles = [];
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
