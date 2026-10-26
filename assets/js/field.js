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
    "landing-page": [[".hero-copy", .14], [".hero-tab-panel-head", .04], [".hero-tab-more", .04]],
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
    let disturbances = new Float32Array(0);
    let offsetsX = new Float32Array(0);
    let offsetsY = new Float32Array(0);
    let taps = [];
    let pointer = null;
    let gravity = 0;
    const interactive = () => !reducedMotion.matches && !document.hidden
      && (currentFieldName() !== "wind" || window.glyphWindFallback);

    window.addEventListener("pointerdown", (event) => {
      if (!interactive() || event.button !== 0 || event.target.closest(".content-card, a, button, input, select, textarea")) return;
      const angle = pointer?.angle ?? -.3;
      const born = performance.now() / 1000;
      taps.push({ x: event.clientX, y: event.clientY, angle, born,
        travel: currentFieldName() === "terrain" ? buildTravel(event.clientX, event.clientY, born * FIELD_TIME_SCALE) : null });
      taps = taps.slice(-5);
    }, { passive: true });
    window.addEventListener("pointermove", (event) => {
      if (!interactive() || event.pointerType !== "mouse") return;
      const now = performance.now() / 1000;
      const next = { x: event.clientX, y: event.clientY, born: now };
      next.angle = pointer ? Math.atan2(next.y - pointer.y, next.x - pointer.x) : -.3;
      pointer = next;
    }, { passive: true });
    function clearInteractions() { taps = []; pointer = null; gravity = 0; }
    window.addEventListener("site-field-change", clearInteractions);
    reducedMotion.addEventListener("change", clearInteractions);
    document.addEventListener("visibilitychange", clearInteractions);

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
      clearInteractions();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.round(window.innerWidth * dpr);
      height = Math.round(window.innerHeight * dpr);
      canvas.width = width;
      canvas.height = height;
      cell = Math.round((FIELDS[currentFieldName()].cellCss || (window.innerWidth < 700 ? 10 : 11)) * dpr);
      columns = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      aspect = width / height;
      values = new Float32Array(columns * rows);
      relief = new Float32Array(columns * rows);
      mask = new Float32Array(columns * rows);
      disturbances = new Float32Array(columns * rows);
      offsetsX = new Float32Array(columns * rows);
      offsetsY = new Float32Array(columns * rows);
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
      const rects = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        rects.push(...range.getClientRects());
      }
      element.querySelectorAll('svg, img').forEach(icon => rects.push(icon.getBoundingClientRect()));
      return rects.filter(rect => rect.width > 4 && rect.height > 4);
    }

    function readLayout() {
      const pageKind = Object.keys(ZONES).find((kind) => document.body.classList.contains(kind));
      zones = (ZONES[pageKind] || []).flatMap(([selector, floor]) => (
        [...document.querySelectorAll(selector)].flatMap((element) => (
          textRects(element).flatMap((line) => {
            const rect = deviceRect(line);
            return rect ? [{ ...rect, floor, radius: 10 * dpr, feather: 55 * dpr }] : [];
          })
        ))
      ));

      const previous = new Map(sinks.map((sink) => [sink.element, sink]));
      sinks = [...document.querySelectorAll(CARD_SELECTOR)].flatMap((element, index) => {
        const clip = element.closest(SCROLL_CLIP_SELECTOR)?.getBoundingClientRect();
        const rect = deviceRect(element.getBoundingClientRect(), clip);
        if (!rect) return [];
        const radius = Math.min(14 * dpr, (rect.bottom - rect.top) / 2);
        return [{
          ...rect,
          radius,
          element,
          hover: previous.get(element)?.hover || 0,
          phase: previous.get(element)?.phase ?? index * 1.37
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
            const cx = (zone.left + zone.right) / 2, cy = (zone.top + zone.bottom) / 2;
            const halfW = Math.max(0, (zone.right - zone.left) / 2 - 12 * dpr);
            const qx = Math.max(0, Math.abs(px - cx) - halfW) / (45 * dpr);
            const qy = (py - cy) / ((zone.bottom - zone.top) / 2 + 22 * dpr);
            const shelter = Math.exp(-qx * qx - qy * qy);
            visible = Math.min(visible, 1 - (1 - Math.max(.18, zone.floor)) * shelter);
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
        const active = !reducedMotion.matches && sink.element.matches(":hover, :focus-within") ? 1 : 0;
        sink.hover += (active - sink.hover) * Math.min(1, dt * 2.1);
        sink.phase += dt * (.18 + sink.hover * .045);
      }
    }

    /* A quiet converging current follows the nearest card edge. Packets move
       inward continuously; their displacement vanishes at either end, so the
       periodic motion never snaps. Inactive cards exert no attraction. */
    function attractionAt(px, py) {
      let best = { dx: 0, dy: 0, salience: 0 };
      for (const sink of sinks) {
        if (sink.hover < .002) continue;
        const tx = Math.max(sink.left, Math.min(sink.right, px));
        const ty = Math.max(sink.top, Math.min(sink.bottom, py));
        const dx = tx - px, dy = ty - py, distance = Math.hypot(dx, dy);
        if (distance < 1 || distance > 260 * dpr) continue;
        const reach = Math.exp(-distance * distance / (125 * dpr) ** 2) * sink.hover;
        const nx = dx / distance, ny = dy / distance;
        const packet = .5 + .5 * Math.cos(distance / (24 * dpr) + sink.phase * 14);
        const strength = reach * (.35 + .65 * packet);
        const bend = Math.sin((px + py) / (100 * dpr) + sink.phase) * .3;
        const shift = Math.min(distance * .4, cell * 1.3) * strength;
        if (strength > best.salience) best = {
          dx: (nx - ny * bend) * shift, dy: (ny + nx * bend) * shift,
          salience: strength
        };
      }
      return best;
    }

    /* ---- Field ----------------------------------------------------------- */

    function buildTravel(x, y, time) {
      const step = 24, w = Math.ceil(width / dpr / step) + 1, h = Math.ceil(height / dpr / step) + 1;
      const altitude = new Float32Array(w * h), distance = new Float32Array(w * h).fill(Infinity);
      const out = { value: new Float32Array(1), relief: new Float32Array(1) };
      for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
        FIELDS.terrain.sample(col * step * dpr / height, row * step * dpr / height, time, out, 0);
        altitude[row * w + col] = out.relief[0];
      }
      const heap = [];
      function push(id, cost) {
        let i = heap.length; heap.push([id, cost]);
        while (i > 0) {
          const parent = (i - 1) >> 1;
          if (heap[parent][1] <= cost) break;
          heap[i] = heap[parent]; i = parent;
        }
        heap[i] = [id, cost];
      }
      function pop() {
        const first = heap[0], end = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let child = i * 2 + 1;
            if (child + 1 < heap.length && heap[child + 1][1] < heap[child][1]) child++;
            if (heap[child][1] >= end[1]) break;
            heap[i] = heap[child]; i = child;
          }
          heap[i] = end;
        }
        return first;
      }
      const origin = Math.min(h - 1, Math.max(0, Math.round(y / step))) * w
        + Math.min(w - 1, Math.max(0, Math.round(x / step)));
      distance[origin] = 0; push(origin, 0);
      while (heap.length) {
        const [id, cost] = pop();
        if (cost > distance[id] + .001) continue;
        const col = id % w, row = Math.floor(id / w);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || col + dx < 0 || col + dx >= w || row + dy < 0 || row + dy >= h) continue;
          const next = (row + dy) * w + col + dx;
          const run = step * Math.hypot(dx, dy);
          const rise = (altitude[next] - altitude[id]) * 1400 / run;
          // Every slope costs energy and time; downhill travel never accelerates beyond flat terrain.
          const candidate = cost + run * (1 + Math.abs(rise) * .45 + rise * rise * .3);
          if (candidate < distance[next]) { distance[next] = candidate; push(next, distance[next]); }
        }
      }
      return { w, h, step, distance };
    }

    function travelAt(map, x, y) {
      const gx = Math.max(0, Math.min(map.w - 1.001, x / map.step));
      const gy = Math.max(0, Math.min(map.h - 1.001, y / map.step));
      const col = Math.floor(gx), row = Math.floor(gy), i = row * map.w + col;
      return mix(mix(map.distance[i], map.distance[i + 1], gx - col),
        mix(map.distance[i + map.w], map.distance[i + map.w + 1], gx - col), gy - row);
    }

    /* Deform the existing field, keeping its glyphs and readability mask.
       CSS-pixel coordinates make interaction reach independent of display DPR. */
    function sampleInteractions(now, time) {
      taps = taps.filter(tap => now - tap.born < 4);
      disturbances.fill(0); offsetsX.fill(0); offsetsY.fill(0);
      const variant = currentFieldName();
      if (!taps.length) return;
      const cx = width / dpr * .70;
      const cy = height / dpr * .48;
      for (let row = 0; row < rows; row++) {
        const y = (row + .5) * cell / dpr;
        for (let column = 0; column < columns; column++) {
          const i = row * columns + column;
          if (mask[i] < .02) continue;
          const x = (column + .5) * cell / dpr;
          let energy = 0, ox = 0, oy = 0;
          for (const tap of taps) {
            const age = now - tap.born;
            const envelope = (1 - Math.exp(-age * 16)) * Math.exp(-age * 1.15);
            let dx = x - tap.x, dy = y - tap.y;
            if (variant === "terrain") {
              // Geodesic travel time bends the wavefront around steep slopes.
              // A compact compression/rarefaction pulse, not a water ring.
              const travel = travelAt(tap.travel, x, y);
              const radius = 360 * (1 - Math.exp(-age / 1.55));
              const delta = travel - radius;
              const band = 34;
              const q = delta / band;
              if (Math.abs(q) > 3.5) continue;
              // The source peaks immediately. Resistance, spreading, and time
              // only remove energy; overlaps sum locally without speeding it up.
              const decay = Math.exp(-age * .85 - travel / 420) / Math.sqrt(1 + travel / 100);
              const pulse = (1 - 1.4 * q * q) * Math.exp(-q * q) * decay;
              const gx = travelAt(tap.travel, x + 8, y) - travelAt(tap.travel, x - 8, y);
              const gy = travelAt(tap.travel, x, y + 8) - travelAt(tap.travel, x, y - 8);
              const norm = Math.max(1, Math.hypot(gx, gy));
              ox += gx / norm * pulse * 22; oy += gy / norm * pulse * 22;
              energy += pulse * .7;
            } else if (variant === "manifold") {
              // A seed opens contour layers into a curved, glyph-filled bloom.
              const radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
              const bloom = Math.exp(-Math.pow((radius - age * 75) / 95, 2)) * envelope;
              const curl = Math.sin(angle * 3 + radius / 60 - age * 2) * bloom;
              ox -= dy / Math.max(1, radius) * curl * 28;
              oy += dx / Math.max(1, radius) * curl * 28;
              energy += curl * .45;
            } else if (variant === "vortex") {
              // A local disturbance is carried inward around the rotating arms.
              const tx = tap.x - cx, ty = (tap.y - cy) * 1.06;
              const originR = Math.hypot(tx, ty), originA = Math.atan2(ty, tx);
              const vx = x - cx, vy = (y - cy) * 1.06;
              const radius = Math.hypot(vx, vy), angle = Math.atan2(vy, vx);
              const arrivalR = Math.max(24, originR - age * 60);
              const arrivalA = originA + age * 1.4;
              const angular = Math.atan2(Math.sin(angle - arrivalA), Math.cos(angle - arrivalA));
              const packet = Math.exp(-Math.pow((radius - arrivalR) / 75, 2)
                - Math.pow(angular / (.45 + age * .16), 2)) * envelope;
              const wave = Math.cos((radius - arrivalR) / 30) * packet;
              ox -= vy / Math.max(1, radius) * wave * 22;
              oy += vx / Math.max(1, radius) * wave * 22;
              energy += wave * .45;
            } else {
              // A narrow jet is advected along the last pointer heading.
              const c = Math.cos(tap.angle), sn = Math.sin(tap.angle);
              const u = dx * c + dy * sn - age * 150, v = -dx * sn + dy * c;
              const jet = Math.exp(-u * u / 18000 - v * v / 1600) * envelope;
              ox -= c * jet * 65; oy -= sn * jet * 65;
              energy += jet * .4;
            }
          }
          disturbances[i] = Math.max(-.4, Math.min(.65, energy));
          const displacementScale = 140 / Math.max(140, Math.hypot(ox, oy));
          offsetsX[i] = ox * displacementScale * dpr;
          offsetsY[i] = oy * displacementScale * dpr;
        }
      }
    }

    function sampleField(field, time) {
      const scale = 1 / height;
      const out = { value: values, relief, gravity };
      for (let row = 0; row < rows; row += 1) {
        const y = (row + .5) * cell * scale;
        for (let column = 0; column < columns; column += 1) {
          const i = row * columns + column;
          out.impulse = disturbances[i];
          field.sample(((column + .5) * cell + offsetsX[i]) * scale,
            y + offsetsY[i] * scale, time, out, i, aspect);
          relief[i] += disturbances[i] * .35;
        }
      }
    }

    function drawField(field, time) {
      const lightX = Math.cos(time * .11);
      const lightY = Math.sin(time * .11);
      const levels = field.glyphs.length;
      const hasAttractors = sinks.some(sink => sink.hover > .002);

      for (let row = 0; row < rows; row += 1) {
        const up = Math.max(0, row - 1) * columns;
        const down = Math.min(rows - 1, row + 1) * columns;
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const visible = mask[index];
          if (visible < .02) continue;

          const px = column * cell;
          const py = row * cell;
          const attraction = hasAttractors
            ? attractionAt(px + cell / 2, py + cell / 2)
            : { strength: 0, hover: 0, dx: 0, dy: 0, salience: 0 };
          const left = relief[row * columns + Math.max(0, column - 1)];
          const right = relief[row * columns + Math.min(columns - 1, column + 1)];
          const gx = right - left;
          const gy = relief[down + column] - relief[up + column];
          const shade = clamp01(.5 + (gx * lightX + gy * lightY) * field.lightGain);

          /* Lit slopes carry heavier glyphs as well as brighter tones. */
          let value = values[index] * (.65 + shade * .7) + disturbances[index] * (field === FIELDS.terrain ? .18 : .25);
          value += attraction.salience * .18;
          value *= visible * (1 + attraction.salience * .78);
          /* Soft knee: compress highlights so the heaviest glyphs stay rare
             and the field keeps a readable range of mid tones. */
          if (value > KNEE) value = KNEE + (value - KNEE) * .38;

          const threshold = BAYER[(row & 7) * 8 + (column & 7)];
          const level = Math.floor(Math.pow(Math.max(0, value), .85) * levels + (threshold - .5) * .9);
          if (level < 1) continue;

          const tone = Math.min(
            TONES - 1,
            Math.floor(clamp01(
              shade * .7 + value * .45 + attraction.salience * .2
            ) * TONES)
          );

          let glyph = Math.min(levels - 1, level - 1);
          if (field.symbolic && level > 2) {
            glyph = 3 + ((column * 73 + row * 41 + Math.floor(time * .10 + (column * 17 + row * 31) % 97 / 97)) % (levels - 3));
          }
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
            Math.round(px + attraction.dx + offsetsX[index] * .18 * visible),
            Math.round(py + attraction.dy + offsetsY[index] * .18 * visible),
            cell,
            cell
          );
        }
      }
    }

    function paint(time) {
      const field = FIELDS[currentFieldName()];
      if (atlasField !== field) rebuildAtlases(field);

      sampleInteractions(performance.now() / 1000, time);
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
      if (document.hidden || (document.documentElement.dataset.field === "wind" && !window.glyphWindFallback)) return;
      const desiredCell = Math.round((FIELDS[currentFieldName()].cellCss || (window.innerWidth < 700 ? 10 : 11)) * dpr);
      if (cell !== desiredCell) resize();
      if (reducedMotion.matches) {
        sinks.forEach(sink => { sink.hover = 0; });
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
