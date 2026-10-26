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
      const height = fbm(x * 1.25 + 3.1, y * 1.25 + 1.7, t * .04) + (out.impulse || 0) * .16;
      const bands = contour(height * 7 - t * .03, 22);
      const summits = smoothstep(.45, .95, height);
      out.value[i] = .05 + height * .2 + bands * (.5 + summits * .4);
      out.relief[i] = height;
    }
  };

  /* Glyph strata: fine symbols trace layered, slowly advecting ridges.
     The stored key remains manifold so existing preferences migrate naturally. */
  const manifold = {
    label: "Glyph strata",
    mark: "≋",
    cellCss: 8,
    glyphs: ["·", ":", ";", "+", "<", ">", "λ", "{", "}", "0", "1"],
    symbolic: true,
    lightGain: 2.6,
    sample(x, y, t, out, i) {
      // Two slow currents braid into contour ribbons, with fine luminous
      // seams and quiet valleys. No global flicker or synchronized glyph jumps.
      const drift = fbm(x * .7 + 7, y * .7 + 2, t * .018);
      const u = x + .28 * Math.sin(y * 3.6 + drift * 2 - t * .055);
      const v = y + .22 * Math.sin(x * 2.4 + drift * 2.5 + t * .04);
      const h = fbm(u * .9 + 3.1, v * .9 + 1.7, t * .018);
      const braid = Math.sin(u * 4.1 + v * 2.2 - t * .08) * .09;
      const height = h + braid + (out.impulse || 0) * .12;
      const layers = contour(height * 6 - t * .018, 3);
      const seam = contour(height * 12 + v * .15 - t * .036, 12);
      const silk = .5 + .5 * Math.sin(u * 5 - v * 3 + t * .07);
      const mist = smoothstep(.22, .75, drift);
      out.value[i] = .035 + layers * (.24 + mist * .35) + seam * .18 + silk * mist * .08;
      out.relief[i] = height + layers * .10 + seam * .025;
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

  /* Integer arm counts keep the polar seam continuous. Broad spiral ridges
     and a single coherent depth surface give the vortex its sculpted shading. */
  const vortex = {
    label: "Representation vortex", mark: "◌", cellCss: 8,
    glyphs: ["·", "∙", ":", "+", "*", "x", "#", "@"], lightGain: 4,
    sample(x, y, t, out, i, aspect) {
      const dx = x - aspect * .70, dy = (y - .48) * 1.06;
      const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const twist = 9 * Math.log(1 + r * 4.5);
      const phase = a * 3 + twist - t * .32 + (out.impulse || 0) * 1.6;
      const curl = Math.sin(a * 2 - r * 8 + t * .075) * .38 * smoothstep(.06, .25, r);
      const ridge = Math.pow(.5 + .5 * Math.cos(phase + curl), 2);
      const filaments = Math.pow(.5 + .5 * Math.cos(phase * 3 + r * 9), 6);
      const backflow = Math.pow(.5 + .5 * Math.cos(a * 5 + twist * 1.55 - t * .22), 7);
      const envelope = Math.exp(-Math.pow(r / .53, 3));
      const eye = smoothstep(.025, .07, r);
      const shade = .72 + .28 * Math.cos(a - 2.2 + r * 4);
      const rim = gauss(r - .075, .025) * .3;
      out.value[i] = .025 + envelope * eye * (.10 + ridge * .62 + filaments * .23 + backflow * .14 + rim) * shade;
      out.relief[i] = envelope * eye * (.24 + Math.sin(phase + curl + .6) * .26 + ridge * .22)
        - gauss(r, .045) * .3;
    }
  };

  window.SITE_FIELDS = { wind: { ...flow, label: "Glyph wind", mark: "≋" }, terrain, manifold, flow, vortex };
})();
