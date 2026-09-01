/*
 * Field variants for the background renderer in field.js.
 *
 * Every variant samples a scalar field over the viewport. `x` runs from 0 to
 * the viewport aspect ratio, `y` from 0 to 1, `t` is time in seconds. Each
 * sample writes two numbers:
 *   value  – how much ink the cell receives (0..1)
 *   relief – a height used for lighting, so the field has real shading
 */
(() => {
  "use strict";

  const TAU = Math.PI * 2;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smoothstep = (edge0, edge1, value) => {
    const amount = clamp01((value - edge0) / (edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
  };
  const fract = (value) => value - Math.floor(value);
  const gauss = (value, spread) => Math.exp(-(value * value) / (spread * spread));

  /* Value noise on an integer lattice, in three dimensions so fields can
     morph in place instead of scrolling. */
  function hash(x, y, z) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function noise(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fy = y - y0;
    const fz = z - z0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);
    const lerp = (a, b, amount) => a + (b - a) * amount;

    const bottom = lerp(
      lerp(hash(x0, y0, z0), hash(x0 + 1, y0, z0), ux),
      lerp(hash(x0, y0 + 1, z0), hash(x0 + 1, y0 + 1, z0), ux),
      uy
    );
    const top = lerp(
      lerp(hash(x0, y0, z0 + 1), hash(x0 + 1, y0, z0 + 1), ux),
      lerp(hash(x0, y0 + 1, z0 + 1), hash(x0 + 1, y0 + 1, z0 + 1), ux),
      uy
    );
    return lerp(bottom, top, uz);
  }

  /* Three octaves, re-centred and stretched so the result spans 0..1 well. */
  function fbm(x, y, z) {
    const sum = noise(x, y, z) * .5
      + noise(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 1.4) * .27
      + noise(x * 4.3 + 9.1, y * 4.3 + 7.7, z * 1.9) * .14;
    return clamp01((sum / .91 - .5) * 2.1 + .5);
  }

  /* A ridge of a contour line at `s` = 0 (mod 1), softened for glyph output. */
  const contour = (s, sharpness) => Math.pow(.5 + .5 * Math.cos(s * TAU), sharpness);

  /*
   * Loss terrain. Slowly morphing hills drawn as a topographic map: contour
   * bands trace the height while hill shading gives the slopes volume.
   */
  const terrain = {
    label: "Loss terrain",
    mark: "▲",
    glyphs: ["·", ":", "-", "=", "+", "*", "#", "%", "@"],
    lightGain: 3.2,
    sample(x, y, t, out, i) {
      const height = fbm(x * 1.25 + 3.1, y * 1.25 + 1.7, t * .04);
      const bands = contour(height * 7 - t * .03, 22);
      const summits = smoothstep(.45, .95, height);
      out.value[i] = .05 + height * .2 + bands * (.5 + summits * .4);
      out.relief[i] = height;
    }
  };

  /*
   * Latent manifold. A folded sheet described by two warped coordinate
   * families; the mesh lines bend with the surface and the relief lights it.
   */
  const manifold = {
    label: "Latent manifold",
    mark: "∿",
    glyphs: ["·", "∙", ":", "+", "=", "*", "x", "#", "@"],
    lightGain: 2.6,
    sample(x, y, t, out, i) {
      const u = x + .22 * Math.sin(y * 2.6 + t * .2) + .05 * Math.sin(y * 8.1 - t * .17);
      const v = y + .18 * Math.sin(x * 1.9 - t * .17) + .04 * Math.cos(x * 5.7 + t * .13);
      const relief = .5
        + .32 * Math.sin(u * 2.7 + .4) * Math.cos(v * 2.3 + t * .15)
        + .14 * Math.sin(u * 5.6 + v * 1.7 - t * .24);
      const mesh = Math.max(contour(u * 3.1, 34), contour(v * 2.6, 34));
      const sheet = smoothstep(.15, .7, relief);
      /* Openings thin the sheet without ever clearing the page: the floor
         keeps a base texture everywhere as the field drifts. */
      const envelope = .5 + .5 * smoothstep(.2, .68, fbm(x * .55 + 2, y * .55 + 6, t * .03));
      out.value[i] = (sheet * .3 + mesh * (.45 + sheet * .45)) * envelope;
      out.relief[i] = relief;
    }
  };

  /*
   * Gradient flow. Bands travel downhill across a potential surface while
   * each glyph is chosen from the local gradient direction, so the whole
   * field reads like a plot of gradient descent.
   */
  const flow = {
    label: "Gradient flow",
    mark: "∇",
    /* Strokes come in light and heavy pairs. The renderer picks the pair from
       the gradient direction and the weight from the value. Screen y grows
       downward, so a gradient pointing down-right draws as a backslash. */
    glyphs: ["-", "─", "/", "╱", "|", "│", "\\", "╲"],
    strokeOffsets: [0, 6, 4, 2],
    directional: true,
    lightGain: 2.2,
    sample(x, y, t, out, i) {
      const potential = fbm(x * 1.35 + 11.3, y * 1.35 + 4.2, t * .04);
      const wave = .5 + .5 * Math.cos(potential * 34 - t * 1.25);
      const slope = smoothstep(.22, .72, potential);
      out.value[i] = (.08 + Math.pow(wave, 2.6) * .78) * (.35 + slope * .65);
      out.relief[i] = potential;
    }
  };

  /*
   * Representation vortex. Rotating spiral arms wind a sparse stream into a
   * bright core, while faint rippling contours keep the surrounding fabric alive.
   */
  const vortex = {
    label: "Representation vortex",
    mark: "◌",
    glyphs: ["·", "∙", ":", "+", "*", "x", "#", "@"],
    lightGain: 2.4,
    sample(x, y, t, out, i, aspect) {
      const dx = (x - aspect * .72 - Math.cos(t * .21) * .012) * .95;
      const dy = (y - .47 - Math.sin(t * .17) * .012) * 1.35;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const swirl = angle - t * .4 + Math.sin(radius * 7 - t * .2) * .16;
      /* Wide, high-contrast arms so the swirl still reads when the middle of
         the page is occupied by content. */
      const arms = Math.pow(.5 + .5 * Math.cos(radius * 17 - swirl * 3.4), 4)
        * gauss(radius - .3, .34);
      const inner = Math.pow(.5 + .5 * Math.cos(radius * 30 - swirl * 2.4 + 1.2), 6)
        * gauss(radius - .12, .16);
      const ring = gauss(radius - .24 - Math.sin(swirl * 3) * .025, .05);
      const core = gauss(radius, .06);
      const fabric = contour(fbm(x * 1.1 + 4, y * 1.1 + 8, t * .05) * 4.5 + t * .05, 10)
        * smoothstep(.3, .8, radius) * .3;
      out.value[i] = .04 + arms * .78 + inner * .4 + ring * .5 + core * .9 + fabric;
      out.relief[i] = .4 + arms * .45 + inner * .3 + core * .6 - radius * .3;
    }
  };

  window.SITE_FIELDS = { terrain, manifold, flow, vortex };
})();
