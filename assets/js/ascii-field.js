(() => {
  "use strict";

  /*
   * The site uses one representation field: a quiet, animated latent manifold.
   * This file intentionally contains only the renderer and its small helpers.
   */

  const GLYPHS = ["·", "∙", ".", ":", ";", "+", "=", "*", "x", "#", "%", "@"];
  const LANDING_PROTECTION = [
    [".hero-copy h1", .08],
    [".hero-copy .intro", .12],
    [".hero-details", .12]
  ];
  const CONTENT_PROTECTION = [
    [".page-intro h1", .1],
    [".page-intro > p", .13]
  ];

  const clamp = (value, minimum = 0, maximum = 1) => (
    Math.min(maximum, Math.max(minimum, value))
  );

  const smoothstep = (edge0, edge1, value) => {
    const normalized = clamp((value - edge0) / (edge1 - edge0));
    return normalized * normalized * (3 - 2 * normalized);
  };

  const gaussian = (value, sharpness) => Math.exp(-(value * value) * sharpness);

  function gridNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function parseColor(value) {
    const hex = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3,8}$/i.test(hex)) {
      const normalized = hex.length === 3
        ? hex.split("").map((digit) => digit + digit).join("")
        : hex;
      return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16)
      ];
    }

    const channels = value.match(/[\d.]+/g);
    return channels?.length >= 3
      ? channels.slice(0, 3).map(Number)
      : [100, 127, 147];
  }

  function mixColor(start, end, amount) {
    const blend = clamp(amount);
    return `rgb(${start.map((channel, index) => Math.round(
      channel + (end[index] - channel) * blend
    )).join(", ")})`;
  }

  /*
   * Two soft ridges, local activations, and a low-amplitude mesh create the
   * manifold. The phase moves slowly so the field feels alive, not animated.
   */
  function manifoldField(x, y, phase, column, row) {
    const ridgeA = .36 * Math.sin(x * 2.8 + phase)
      + .12 * Math.sin(x * 7.2 - phase * .62);
    const ridgeB = -.3 * Math.sin(x * 2.15 - phase * .74)
      + .15 * Math.cos(x * 5.4 + phase * .46);
    const layerA = gaussian(y - ridgeA, 18);
    const layerB = gaussian(y - ridgeB, 24);
    const envelope = Math.exp(-((x - .12) ** 2) * .14 - (y ** 2) * .26);
    const activationA = Math.exp(
      -((x - .42 - Math.sin(phase) * .035) ** 2) * 17
      -((y + .03) ** 2) * 26
    );
    const activationB = Math.exp(
      -((x + .13) ** 2) * 24
      -((y - .24 - Math.cos(phase * .7) * .025) ** 2) * 30
    );
    const mesh = .11 + .12 * (
      .5 + .5 * Math.sin(x * 5.4 - y * 4.2 + phase * .72)
    );
    const traceA = .13 * gaussian(y - .56 * Math.sin(x * 1.65 + phase), 5);
    const traceB = .1 * gaussian(x - .42 * Math.cos(y * 2.1 - phase), 5);
    const texture = .72 + .28 * Math.sin(x * 12 + y * 9 + phase * 1.3);
    const edgeFade = .66 + .34 * clamp(1 - Math.abs(x) ** 2.2);

    return {
      intensity: (
        (layerA * .66 + layerB * .42) * envelope * texture
        + activationA * .42
        + activationB * .28
        + mesh
        + traceA
        + traceB
      ) * edgeFade * (.78 + gridNoise(column, row) * .3),
      driftX: Math.sin(y * 4.2 + phase) * 2.2,
      driftY: Math.cos(x * 3.6 - phase * .65) * 1.3
    };
  }

  function initializeAsciiField() {
    const canvas = document.querySelector("[data-ascii-manifold]");
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context || canvas.dataset.asciiFieldReady === "true") return;
    canvas.dataset.asciiFieldReady = "true";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fuelStrengths = new WeakMap();
    let viewportWidth = 0;
    let viewportHeight = 0;
    let fieldColorRgb = [100, 127, 147];
    let accentColorRgb = [154, 123, 87];
    let protectionAreas = [];
    let fuelTargets = [];
    let animationFrame = 0;
    let lastPaint = -Infinity;
    let lastLayoutRead = -Infinity;
    let resizeTimer = 0;

    function readPalette() {
      fieldColorRgb = parseColor(window.getComputedStyle(canvas).color);
      accentColorRgb = parseColor(
        window.getComputedStyle(document.documentElement)
          .getPropertyValue("--fuel-accent")
      );
    }

    function readProtectionAreas() {
      const definitions = document.body.classList.contains("landing-page")
        ? LANDING_PROTECTION
        : CONTENT_PROTECTION;

      protectionAreas = definitions.flatMap(([selector, protectedOpacity]) => (
        [...document.querySelectorAll(selector)].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width && rect.height
            ? [{
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              protectedOpacity
            }]
            : [];
        })
      ));
    }

    // Cards are gentle attractors: the existing field streams toward each row.
    function readFuelTargets(bounds) {
      const cards = [...document.querySelectorAll(
        ".hero-tab-panel .content-card, .content-page .content-card, .mobile-tab-section .content-card"
      )];

      fuelTargets = cards.flatMap((card, index) => {
        const rect = card.getBoundingClientRect();
        const clip = card.closest(
          ".hero-tab-list, .content-list-region, .mobile-tab-section-list"
        )?.getBoundingClientRect();
        const top = Math.max(rect.top, bounds.top, clip?.top ?? bounds.top);
        const bottom = Math.min(rect.bottom, bounds.bottom, clip?.bottom ?? bounds.bottom);
        return rect.width && rect.height && bottom - top >= 14
          ? [{ card, index, left: rect.left, right: rect.right, top, bottom }]
          : [];
      });
    }

    function updateFuelStrengths() {
      fuelTargets.forEach((target) => {
        const active = target.card.matches(":hover")
          || target.card.matches(":focus-within");
        const goal = active ? 1 : 0;
        const current = fuelStrengths.get(target.card) || 0;
        fuelStrengths.set(
          target.card,
          reducedMotion.matches ? goal : current + (goal - current) * .12
        );
      });
    }

    function fuelAttractionAt(x, y, timestamp, compact) {
      let strongest = null;

      fuelTargets.forEach((target) => {
        const strength = fuelStrengths.get(target.card) || 0;
        const centerY = (target.top + target.bottom) * .5;
        const sinkX = Math.min(
          target.right,
          target.left + Math.min(compact ? 34 : 52, (target.right - target.left) * .1)
        );
        const sourceX = Math.max(0, target.left - (compact ? 240 : 560));
        if (x < sourceX || x > sinkX) return;

        const progress = clamp((x - sourceX) / Math.max(1, sinkX - sourceX));
        const curvePhase = timestamp * .000065 + target.index * .91;
        const curveAt = (position) => {
          const envelope = .28 + .72 * (1 - Math.pow(position, .74));
          const broad = Math.sin(position * Math.PI * 1.55 + curvePhase) * (compact ? 26 : 72);
          const counter = Math.sin(position * Math.PI * 3.75 - curvePhase * .72 + target.index) * (compact ? 9 : 25);
          const soft = Math.sin(position * Math.PI * .72 + curvePhase * .45) * (compact ? 7 : 18);
          return centerY + envelope * (broad + counter + soft);
        };
        const radiusAt = (position) => (
          (compact ? 44 : 84)
          * (1 - position * .76)
          * (.76 + .24 * Math.sin(position * Math.PI * 3.4 + curvePhase * .8))
        );
        const currentY = curveAt(progress);
        const radius = radiusAt(progress);
        const lane = (y - currentY) / Math.max(1, radius);
        const pathStrength = gaussian(lane, 3.2) * smoothstep(0, .16, progress);
        const flowSpeed = .0000062 * (1 + strength * 1.7);
        const travel = reducedMotion.matches
          ? progress
          : (progress + timestamp * flowSpeed) % 1;
        // A stream only moves toward the card. When a particle cycle wraps,
        // keeping the current position prevents a visible push back into the field.
        const arrivalProgress = Math.max(progress, travel);
        const mappedX = sourceX + arrivalProgress * (sinkX - sourceX);
        const mappedY = curveAt(arrivalProgress) + lane * radiusAt(arrivalProgress);
        const arrival = smoothstep(.08, .96, arrivalProgress);
        const attraction = .34 + strength * .14;
        const candidate = {
          influence: gaussian((y - currentY) / Math.max(compact ? 11 : 15, radius), 1.65)
            * smoothstep(0, .18, progress),
          driftX: (mappedX - x) * pathStrength * attraction,
          driftY: (mappedY - y) * pathStrength * attraction,
          pathStrength,
          hoverStrength: strength,
          colorStrength: pathStrength * arrival * (.14 + strength * .72),
          salience: strength * pathStrength * (.4 + arrival * .6)
        };

        if (!strongest || candidate.influence > strongest.influence) strongest = candidate;
      });

      return strongest || {
        influence: 0, driftX: 0, driftY: 0, pathStrength: 0,
        colorStrength: 0, salience: 0, hoverStrength: 0
      };
    }

    function readabilityAt(x, y) {
      return protectionAreas.reduce((visibility, area) => {
        const centerX = (area.left + area.right) * .5;
        const centerY = (area.top + area.bottom) * .5;
        const radiusX = Math.max((area.right - area.left) * .5 + 26, 34);
        const radiusY = Math.max((area.bottom - area.top) * .5 + 18, 25);
        const distance = Math.hypot(
          (x - centerX) / radiusX,
          (y - centerY) / radiusY
        );
        return Math.min(
          visibility,
          area.protectedOpacity + smoothstep(.62, 1.2, distance) * (1 - area.protectedOpacity)
        );
      }, 1);
    }

    function resizeCanvas() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(viewportWidth * pixelRatio);
      canvas.height = Math.round(viewportHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.textAlign = "center";
      context.textBaseline = "middle";
      readPalette();
    }

    function getDrawingBounds() {
      const headerBottom = document.querySelector(".site-header")
        ?.getBoundingClientRect().bottom ?? 0;
      const footerTop = document.querySelector("footer")
        ?.getBoundingClientRect().top ?? viewportHeight;
      const top = clamp(headerBottom, 0, viewportHeight);
      return { top, bottom: clamp(footerTop, top, viewportHeight) };
    }

    function draw(timestamp = 0) {
      const compact = viewportWidth < 700;
      const cellSize = compact ? 13 : 15;
      const columns = Math.ceil(viewportWidth / cellSize) + 1;
      const rows = Math.ceil(viewportHeight / cellSize) + 1;
      const phase = reducedMotion.matches ? 0 : timestamp * .000078;
      const bounds = getDrawingBounds();

      if (timestamp - lastLayoutRead >= 100) {
        readProtectionAreas();
        readFuelTargets(bounds);
        lastLayoutRead = timestamp;
      }
      updateFuelStrengths();
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      context.font = `500 ${compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

      context.save();
      context.beginPath();
      context.rect(0, bounds.top, viewportWidth, bounds.bottom - bounds.top);
      context.clip();

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellSize;
        const normalizedY = (y / viewportHeight) * 2 - 1;

        for (let column = 0; column < columns; column += 1) {
          const x = column * cellSize;
          const normalizedX = (x / viewportWidth) * 2 - 1;
          const field = manifoldField(normalizedX, normalizedY, phase, column, row);
          const fuel = fuelAttractionAt(x, y, timestamp, compact);
          const readability = readabilityAt(x, y);
          // Add a low-energy stream on top of the field instead of erasing the
          // field around cards. Hovering raises its energy without changing its path.
          const streamEnergy = fuel.pathStrength * (.12 + fuel.hoverStrength * .12);
          const intensity = clamp(
            field.intensity * (.76 + readability * .46) + streamEnergy
          );
          const random = gridNoise(column + 47, row + 19);
          const density = fuel.pathStrength * (.78 + fuel.hoverStrength * .22);
          if (
            intensity < .1
            || random > Math.max(.5 + intensity * .5, .3 + density * .68)
            || (readability < .24 && gridNoise(column + 91, row + 7) > .3)
          ) continue;

          const characterIndex = Math.min(
            GLYPHS.length - 1,
            Math.floor(Math.pow(intensity, .82) * GLYPHS.length)
          );
          const glyphShade = .68
            + (characterIndex / Math.max(1, GLYPHS.length - 1)) * .32;
          const alpha = (.03 + intensity * .44)
            * readability
            * glyphShade
            * (1 + fuel.pathStrength * (.42 + fuel.hoverStrength * .22))
            * (1 + fuel.salience * .82);
          const color = fuel.colorStrength > .008
            ? mixColor(fieldColorRgb, accentColorRgb, fuel.colorStrength)
            : `rgb(${fieldColorRgb.join(", ")})`;

          context.globalAlpha = alpha;
          context.fillStyle = color;
          context.shadowColor = color;
          context.shadowBlur = intensity > .8 ? 7 : 0;
          context.fillText(
            GLYPHS[characterIndex],
            x + field.driftX * intensity + fuel.driftX,
            y + field.driftY * intensity + fuel.driftY
          );
        }
      }

      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.restore();
    }

    function animate(timestamp) {
      const paintInterval = viewportWidth < 700 ? 52 : 36;
      if (timestamp - lastPaint >= paintInterval) {
        draw(timestamp);
        lastPaint = timestamp;
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    function updateMotion() {
      window.cancelAnimationFrame(animationFrame);
      lastPaint = -Infinity;
      if (reducedMotion.matches) draw(0);
      else animationFrame = window.requestAnimationFrame(animate);
    }

    function invalidateLayout() {
      lastLayoutRead = -Infinity;
    }

    document.addEventListener("scroll", invalidateLayout, { passive: true, capture: true });
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeCanvas();
        invalidateLayout();
        draw(window.performance.now());
      }, 120);
    }, { passive: true });
    window.addEventListener("site-route-change", () => {
      invalidateLayout();
      draw(window.performance.now());
    });
    window.addEventListener("site-theme-change", () => {
      readPalette();
      draw(window.performance.now());
    });
    reducedMotion.addEventListener?.("change", updateMotion);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) window.cancelAnimationFrame(animationFrame);
      else updateMotion();
    });

    resizeCanvas();
    updateMotion();
  }

  window.initializeAsciiField = initializeAsciiField;
  initializeAsciiField();
})();
