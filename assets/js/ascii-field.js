(() => {
  "use strict";

  const CHARACTER_SETS = {
    manifold: ["·", "∙", ".", ":", ";", "+", "=", "*", "x", "#", "%", "@"],
    topography: ["·", ".", ":", "~", "-", "=", "+", "*", "o", "@"],
    activation: ["·", ".", ":", ";", "-", "~", "+", "=", "x", "%"],
    attention: ["·", ".", ":", "|", "-", "+", "x", "#", "%", "@"],
    embedding: ["·", "∙", ".", ":", ";", "+", "*", "o", "O", "@"],
    pathology: ["·", ".", ":", ";", "+", "=", "x", "#", "%", "@"],
    loss: ["·", ".", ":", "-", "~", "=", "+", "x", "#"],
    cubes: ["·", ".", ":", "-", "/", "\\", "+", "◇", "#"],
    flow: ["·", ".", ":", "-", "~", "=", "+", ">", "»"],
    network: ["·", ".", ":", "+", "x", "#", "%", "@"],
    latent: ["·", "∙", ".", ":", ";", "+", "*", "o", "O", "@"],
    orbit: ["·", ".", ":", "-", "+", "*", "o", "O", "@"],
    cosmic: ["·", ".", ":", "+", "*", "x", "✦", "#", "%", "@"]
  };

  // Each field has its own calm tempo; one phase cycle lasts roughly a minute.
  const FIELD_MOTION_SPEED = {
    manifold: .82,
    topography: .64,
    activation: .9,
    attention: .88,
    embedding: .66,
    pathology: .56,
    loss: .58,
    cubes: .62,
    flow: .8,
    network: .82,
    latent: .64,
    orbit: .7,
    cosmic: .72
  };

  const LANDING_PROTECTION = [
    [".hero-copy h1", .08],
    [".hero-copy .intro", .12],
    [".hero-copy .hero-quote", .12],
    [".hero-details", .12],
    [".hero-tab-panel:not([hidden])", .18],
    [".mobile-tab-section", .18],
    [".ascii-picker-menu:not([hidden])", .08]
  ];

  const CONTENT_PROTECTION = [
    [".page-intro h1", .1],
    [".page-intro > p", .13],
    [".ascii-picker-menu:not([hidden])", .08]
  ];

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function smoothstep(edge0, edge1, value) {
    const normalized = clamp((value - edge0) / (edge1 - edge0));
    return normalized * normalized * (3 - 2 * normalized);
  }

  function gaussian(value, sharpness) {
    return Math.exp(-(value * value) * sharpness);
  }

  function gridNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function parseColor(value) {
    const hex = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3,8}$/i.test(hex)) {
      const normalized = hex.length === 3
        ? hex.split("").map((digit) => `${digit}${digit}`).join("")
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

  function pointSegmentDistanceSquared(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSquared = abx * abx + aby * aby;
    const projection = lengthSquared === 0
      ? 0
      : clamp(((px - ax) * abx + (py - ay) * aby) / lengthSquared);
    const dx = px - (ax + abx * projection);
    const dy = py - (ay + aby * projection);
    return dx * dx + dy * dy;
  }

  function segmentProgress(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    return lengthSquared === 0
      ? 0
      : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared);
  }

  function buildNetwork() {
    const layerX = [-.72, -.26, .2, .66];
    const layerCounts = [4, 6, 6, 4];
    const layers = layerX.map((x, layerIndex) => {
      const count = layerCounts[layerIndex];
      return Array.from({ length: count }, (_, index) => ({
        x,
        y: count === 1 ? 0 : -.58 + (index / (count - 1)) * 1.16,
        phase: layerIndex * .7 + index * .41
      }));
    });
    const edges = [];

    for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
      const current = layers[layerIndex];
      const next = layers[layerIndex + 1];

      current.forEach((node, index) => {
        const mappedIndex = Math.round((index / Math.max(1, current.length - 1)) * (next.length - 1));
        [mappedIndex, (mappedIndex + 2) % next.length].forEach((targetIndex) => {
          edges.push([node, next[targetIndex]]);
        });
      });
    }

    return { nodes: layers.flat(), edges };
  }

  const NETWORK = buildNetwork();

  function buildFeatureCubes() {
    const cubes = [
      [-.5, -.22, .2], [-.18, -.42, .16], [.17, -.26, .22],
      [.49, -.47, .15], [-.36, .25, .17], [.04, .19, .24], [.42, .27, .19]
    ];
    const edges = [];

    cubes.forEach(([centerX, centerY, size]) => {
      const vertices = Array.from({ length: 8 }, (_, index) => {
        const a = (index & 1) ? .5 : -.5;
        const b = (index & 2) ? .5 : -.5;
        const c = (index & 4) ? .5 : -.5;
        return {
          x: centerX + (a - b) * size * .72,
          y: centerY + (a + b) * size * .34 - c * size * .9
        };
      });

      vertices.forEach((vertex, index) => {
        [1, 2, 4].forEach((bit) => {
          if ((index & bit) === 0) edges.push([vertex, vertices[index | bit]]);
        });
      });
    });

    return edges;
  }

  function buildCosmicWeb() {
    const nodes = [
      [-.77, -.28, .42], [-.56, .34, .25], [-.39, -.04, .58],
      [-.13, -.38, .22], [-.08, .19, .88], [.19, -.11, .36],
      [.34, .4, .26], [.46, .04, .68], [.7, -.32, .31],
      [.78, .27, .22], [.06, .55, .2]
    ].map(([x, y, strength], index) => ({ x, y, strength, phase: index * .63 }));
    const pairs = [
      [0, 2], [0, 1], [1, 2], [1, 4], [2, 3], [2, 4], [2, 5],
      [3, 5], [4, 5], [4, 6], [4, 10], [5, 7], [6, 7], [6, 9],
      [7, 8], [7, 9], [8, 9]
    ];
    return { nodes, pairs };
  }

  const FEATURE_CUBE_EDGES = buildFeatureCubes();
  const COSMIC_WEB = buildCosmicWeb();
  let cosmicFramePhase = Number.NaN;
  let cosmicFrame = { nodes: [], edges: [] };

  function getCosmicFrame(phase) {
    if (phase === cosmicFramePhase) return cosmicFrame;

    const nodes = COSMIC_WEB.nodes.map((node) => ({
      ...node,
      x: node.x + Math.sin(phase * .46 + node.phase) * .022,
      y: node.y + Math.cos(phase * .39 + node.phase * 1.17) * .017
    }));

    cosmicFramePhase = phase;
    cosmicFrame = {
      nodes,
      edges: COSMIC_WEB.pairs.map(([start, end]) => [nodes[start], nodes[end]])
    };
    return cosmicFrame;
  }

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
    const mesh = .11 + .12 * (.5 + .5 * Math.sin(x * 5.4 - y * 4.2 + phase * .72));
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

  function topographyField(x, y, phase, column, row) {
    const peakAX = -.3 + Math.sin(phase * .38) * .025;
    const peakAY = -.02 + Math.cos(phase * .31) * .018;
    const peakBX = .38 + Math.cos(phase * .29) * .022;
    const peakBY = .2 + Math.sin(phase * .35) * .016;
    const peakA = Math.exp(-((x - peakAX) ** 2) * 3.2 - ((y - peakAY) ** 2) * 5.5);
    const peakB = Math.exp(-((x - peakBX) ** 2) * 5.6 - ((y - peakBY) ** 2) * 8.4);
    const basin = Math.exp(-((x - .05) ** 2) * 4.8 - ((y + .38) ** 2) * 11);
    const height = peakA * .9 + peakB * .62 - basin * .34;
    const envelope = smoothstep(.025, .18, Math.abs(height));
    const contours = gaussian(Math.sin(height * 51 - phase * .56), 30) * envelope;
    const radialTrace = gaussian(
      Math.sin(Math.hypot(x - peakAX, y - peakAY) * 42 + phase * .34),
      34
    ) * peakA;
    const grain = .72 + gridNoise(column * 1.4, row * 1.8) * .35;

    return {
      intensity: .018 + contours * .52 * grain + radialTrace * .15 + peakA * .12 + peakB * .1,
      driftX: Math.sin(y * 4 + phase * .44) * .42,
      driftY: Math.cos(x * 3 - phase * .37) * .32
    };
  }

  function activationField(x, y, phase, column, row) {
    const upperWave = -.25 + .22 * Math.sin(x * 3.1 + phase * .62)
      + .06 * Math.sin(x * 7.4 - phase * .38);
    const lowerWave = .26 - .18 * Math.sin(x * 2.55 - phase * .51)
      + .07 * Math.cos(x * 6.2 + phase * .32);
    const upper = gaussian(y - upperWave, 20);
    const lower = gaussian(y - lowerWave, 23);
    const crossing = gaussian(y - (upperWave + lowerWave) * .5, 7);
    const envelope = gaussian(x, .24) * (.72 + .28 * gaussian(y, .7));
    const travelingPulse = .63 + .37 * Math.cos(x * 5.2 - phase * .9);
    const activation = Math.max(upper, lower)
      * (.54 + .3 * gridNoise(column, row) + .16 * travelingPulse);
    const lattice = gaussian(Math.sin(x * 18 + y * 7 - phase * .46), 18) * crossing * .13;

    return {
      intensity: .02 + activation * envelope * .67 + lattice,
      driftX: Math.sin(y * 5 + phase * .52) * .7,
      driftY: Math.cos(x * 4 - phase * .43) * .55
    };
  }

  function attentionField(x, y, phase, column, row) {
    const diagonalY = -.56 * x + Math.sin(x * 5 + phase * .48) * .035;
    const diagonal = gaussian(y - diagonalY, 105) * gaussian(x, .55);
    const reverse = gaussian(y - .7 * x - .08, 260) * gaussian(x + .12, 2.1);
    const tokenX = gaussian(Math.sin((x + 1) * Math.PI * 8), 45);
    const tokenY = gaussian(Math.sin((y + 1) * Math.PI * 7), 45);
    const guides = (tokenX + tokenY) * .075 * gaussian(x, .28) * gaussian(y, .4);
    const focusX = Math.sin(phase * .42) * .62;
    const focusY = -.56 * focusX;
    const focus = Math.exp(-((x - focusX) ** 2) * 55 - ((y - focusY) ** 2) * 75);
    const center = Math.exp(-((x + .02) ** 2) * 22 - ((y - .02) ** 2) * 28);
    const sparse = .65 + gridNoise(column * 2.3, row * 1.7) * .4;

    return {
      intensity: .016 + diagonal * .58 * sparse + reverse * .2 + guides + center * .22 + focus * .55,
      driftX: Math.sin(y * 6 + phase * .4) * .28,
      driftY: Math.cos(x * 5 - phase * .34) * .28
    };
  }

  function embeddingField(x, y, phase, column, row) {
    const rotation = phase * .1;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    const clusterA = Math.exp(-((u + .42 - Math.sin(phase * .38) * .018) ** 2) * 10 - ((v + .11) ** 2) * 18);
    const clusterB = Math.exp(-((u - .06) ** 2) * 13 - ((v - .3 - Math.cos(phase * .32) * .018) ** 2) * 16);
    const clusterC = Math.exp(-((u - .46 + Math.sin(phase * .29) * .02) ** 2) * 17 - ((v + .18) ** 2) * 11);
    const bridgeA = gaussian(v + .42 * u + .16, 44) * gaussian(u + .17, 2.4);
    const bridgeB = gaussian(v - .5 * u + .05, 53) * gaussian(u - .2, 2.8);
    const density = clusterA * .8 + clusterB * .7 + clusterC * .76;
    const speckle = .42 + gridNoise(column * 2.1, row * 2.7) * .7;
    const shell = gaussian(Math.sin(density * 39 - phase * .38), 20) * smoothstep(.08, .3, density);

    return {
      intensity: .015 + density * .48 * speckle + shell * .18 + (bridgeA + bridgeB) * .1,
      driftX: Math.sin(v * 5 + phase * .42) * .6,
      driftY: Math.cos(u * 4 - phase * .36) * .48
    };
  }

  function pathologyField(x, y, phase, column, row) {
    const broadShape = Math.exp(-(x * x * .75 + y * y * 1.35));
    const cellular = (
      Math.sin(x * 5.7 + Math.sin(y * 3.1) + phase * .31)
      + Math.cos(y * 7.1 - x * 2.2 - phase * .26)
      + Math.sin((x + y) * 4.2 + phase * .19) * .72
    ) / 2.72;
    const tissue = broadShape * (1.04 + cellular * .62);
    const boundary = gaussian(tissue - .53, 185);
    const inside = smoothstep(.43, .66, tissue);
    const cavities = gaussian(
      Math.sin(x * 14.5 + y * 5.2 + phase * .34)
        * Math.cos(y * 12.3 - x * 3.1 - phase * .27),
      32
    );
    const texture = .54 + gridNoise(column * 1.9, row * 2.4) * .54;

    return {
      intensity: .014 + boundary * .58 + inside * (.13 + cavities * .22) * texture,
      driftX: Math.sin(y * 5 + phase * .3) * .3,
      driftY: Math.cos(x * 4 - phase * .26) * .24
    };
  }

  function lossField(x, y, phase) {
    const rotation = Math.sin(phase * .28) * .035;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    const hillA = Math.exp(-((u + .15) ** 2) * 2.7 - ((v + .03) ** 2) * 4.2);
    const hillB = Math.exp(-((u - .5) ** 2) * 7.5 - ((v - .1) ** 2) * 9);
    const valley = Math.exp(-((u + .52) ** 2) * 8 - ((v - .32) ** 2) * 12);
    const height = hillA * .58 + hillB * .32 - valley * .22;
    const warpedY = v + height * .42;
    const horizontal = gaussian(Math.sin((warpedY + 1) * 29 + phase * .29), 40);
    const warpedX = u + v * .18 + height * .17;
    const vertical = gaussian(Math.sin((warpedX + 1) * 27 - phase * .23), 46);
    const envelope = gaussian(u, .42) * gaussian(v, .78);

    return {
      intensity: .015 + (horizontal * .39 + vertical * .27) * envelope + height * .08,
      driftX: Math.sin(v * 4 + phase * .3) * .3,
      driftY: Math.cos(u * 3 - phase * .25) * .2
    };
  }

  function cubesField(x, y, phase) {
    let edgeStrength = 0;
    const sampleX = x - Math.sin(phase * .31) * .014;
    const sampleY = y - Math.cos(phase * .27) * .011;

    FEATURE_CUBE_EDGES.forEach(([start, end], index) => {
      const distanceSquared = pointSegmentDistanceSquared(
        sampleX,
        sampleY,
        start.x,
        start.y,
        end.x,
        end.y
      );
      const scan = .5 + .5 * Math.sin(phase * .68 - index * .29);
      const pulse = .72 + .28 * scan;
      edgeStrength = Math.max(edgeStrength, Math.exp(-distanceSquared * 1850) * pulse);
    });

    const ambient = gaussian(x, .5) * gaussian(y, .7) * .025;
    return {
      intensity: .012 + edgeStrength * .72 + ambient,
      driftX: 0,
      driftY: Math.sin(x * 4 + phase * .35) * .15
    };
  }

  function flowField(x, y, phase) {
    const coreX = .57 + Math.sin(phase * .7) * .018;
    const coreY = Math.cos(phase * .55) * .018;
    const dx = x - coreX;
    const dy = y - coreY;
    const distance = Math.hypot(dx * .88, dy);
    const upstream = clamp((coreX - x + .14) / 1.72);
    const bend = y
      + Math.sin((x + 1.2) * 2.3 + phase * .7) * (.04 + upstream * .09)
      + Math.sin((x + .4) * 5.1 - phase * .32) * .018;
    const streams = gaussian(Math.sin(bend * 33 + x * 2.1), 13);
    const fan = gaussian(y, .6) * smoothstep(-1.05, -.7, x) * (1 - smoothstep(.72, .96, x));
    const rings = gaussian(Math.sin(distance * 34 - phase * .35), 18)
      * gaussian(distance, 1.35)
      * smoothstep(.36, -.08, Math.abs(x - coreX));
    const core = gaussian(distance, 92);
    const wake = gaussian(y - Math.sin(x * 3.1 + phase) * .05, 55)
      * gaussian(x - coreX, 1.8);

    return {
      intensity: .025 + streams * fan * (.18 + upstream * .48) + rings * .34 + core * .92 + wake * .12,
      driftX: upstream * 2.4,
      driftY: Math.sin(x * 3 + phase) * .7
    };
  }

  function networkField(x, y, phase) {
    let nodeStrength = 0;
    let edgeStrength = 0;

    NETWORK.nodes.forEach((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      const pulse = .82 + .18 * Math.sin(phase * 1.5 + node.phase);
      nodeStrength = Math.max(nodeStrength, Math.exp(-(dx * dx + dy * dy) * 255) * pulse);
    });

    NETWORK.edges.forEach(([start, end], index) => {
      const distanceSquared = pointSegmentDistanceSquared(
        x,
        y,
        start.x,
        start.y,
        end.x,
        end.y
      );
      const pulse = .72 + .28 * Math.sin(phase * 1.2 + index * .37);
      const progress = segmentProgress(x, y, start.x, start.y, end.x, end.y);
      const signal = Math.pow(.5 + .5 * Math.cos(
        (progress - phase * .13 - index * .08) * Math.PI * 2
      ), 8);
      edgeStrength = Math.max(
        edgeStrength,
        Math.exp(-distanceSquared * 1450) * (pulse * .68 + signal * .52)
      );
    });

    const layerGlow = gaussian(Math.sin((x + .72) * Math.PI * 3.2), 24) * gaussian(y, .75);
    return {
      intensity: .018 + nodeStrength * .9 + edgeStrength * .32 + layerGlow * .07,
      driftX: 0,
      driftY: Math.sin(x * 5 + phase) * .35
    };
  }

  function latentField(x, y, phase, column, row) {
    const rotation = .16 * Math.sin(phase * .5);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    const radius = Math.hypot(u / .82, v / .52);
    const angle = Math.atan2(v, u);
    const shell = gaussian(Math.sin(radius * 23 + angle * 2.6 - phase * .45), 12)
      * gaussian(radius - .72, 1.25);
    const cloud = Math.exp(-(u * u * 1.3 + v * v * 3.2));
    const axisA = gaussian(v + u * .24, 300) * gaussian(u, .55);
    const axisB = gaussian(v - u * .34, 360) * gaussian(u, .65);
    const activationA = Math.exp(-((u - .31) ** 2) * 30 - ((v + .08) ** 2) * 45);
    const activationB = Math.exp(-((u + .26) ** 2) * 36 - ((v - .2) ** 2) * 48);
    const granularity = .68 + gridNoise(column * 1.7, row * 1.3) * .42;

    return {
      intensity: .02 + shell * cloud * .48 * granularity + axisA * .14 + axisB * .11 + activationA * .48 + activationB * .34,
      driftX: Math.sin(angle + phase) * 1.4,
      driftY: Math.cos(angle - phase * .6) * .8
    };
  }

  function orbitField(x, y, phase) {
    const first = {
      x: .28 + Math.sin(phase * .55) * .025,
      y: -.08 + Math.cos(phase * .48) * .02
    };
    const second = {
      x: -.31 + Math.cos(phase * .42) * .02,
      y: .22 + Math.sin(phase * .52) * .024
    };
    const r1 = Math.hypot((x - first.x) / .86, (y - first.y) / .62);
    const r2 = Math.hypot((x - second.x) / .68, (y - second.y) / .48);
    const ringsA = gaussian(Math.sin(r1 * 27 - phase * .28), 18) * gaussian(r1, .72);
    const ringsB = gaussian(Math.sin(r2 * 31 + phase * .22), 21) * gaussian(r2, .9);
    const orbitA = gaussian(r1 - .58, 180);
    const orbitB = gaussian(r2 - .72, 210);
    const coreA = gaussian(r1, 115);
    const coreB = gaussian(r2, 128);
    const bridge = Math.exp(-pointSegmentDistanceSquared(
      x,
      y,
      first.x,
      first.y,
      second.x,
      second.y
    ) * 520);

    return {
      intensity: .018 + ringsA * .24 + ringsB * .19 + orbitA * .42 + orbitB * .35 + coreA * .88 + coreB * .66 + bridge * .14,
      driftX: Math.sin(y * 5 + phase) * 1.1,
      driftY: Math.cos(x * 4 - phase * .7) * .8
    };
  }

  function cosmicField(x, y, phase, column, row) {
    let nodeStrength = 0;
    let haloStrength = 0;
    let edgeStrength = 0;
    const geometry = getCosmicFrame(phase);

    geometry.nodes.forEach((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      const distanceSquared = dx * dx + dy * dy;
      const pulse = .78 + .22 * Math.sin(phase * .72 + node.phase);
      nodeStrength = Math.max(
        nodeStrength,
        Math.exp(-distanceSquared * 320) * node.strength * pulse
      );
      haloStrength += Math.exp(-distanceSquared * 24) * node.strength * .16;
    });

    geometry.edges.forEach(([start, end], index) => {
      const distanceSquared = pointSegmentDistanceSquared(
        x,
        y,
        start.x,
        start.y,
        end.x,
        end.y
      );
      const progress = segmentProgress(x, y, start.x, start.y, end.x, end.y);
      const travelingSignal = Math.pow(.5 + .5 * Math.cos(
        (progress - phase * .09 - index * .11) * Math.PI * 2
      ), 10);
      const pulse = .68 + .2 * Math.sin(phase * .54 + index * .71) + travelingSignal * .34;
      edgeStrength = Math.max(edgeStrength, Math.exp(-distanceSquared * 1900) * pulse);
    });

    const dust = gaussian(x, .34) * gaussian(y, .55)
      * gridNoise(column * 2.8, row * 2.1)
      * (.72 + .28 * Math.sin(x * 5.4 + y * 3.7 + phase * .48))
      * .13;

    return {
      intensity: .012 + nodeStrength * .94 + haloStrength + edgeStrength * .36 + dust,
      driftX: Math.sin(y * 5 + phase * .44) * .38,
      driftY: Math.cos(x * 4 - phase * .37) * .3
    };
  }

  const FIELD_FUNCTIONS = {
    manifold: manifoldField,
    topography: topographyField,
    activation: activationField,
    attention: attentionField,
    embedding: embeddingField,
    pathology: pathologyField,
    loss: lossField,
    cubes: cubesField,
    flow: flowField,
    network: networkField,
    latent: latentField,
    orbit: orbitField,
    cosmic: cosmicField
  };

  function initializeAsciiField() {
    const canvas = document.querySelector("[data-ascii-manifold]");
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let viewportWidth = 0;
    let viewportHeight = 0;
    let fieldColor = "rgb(100, 127, 147)";
    let fieldColorRgb = [100, 127, 147];
    let accentColorRgb = [102, 128, 147];
    let animationFrame = 0;
    let lastPaint = -Infinity;
    let lastProtectionRead = -Infinity;
    let lastFuelRead = -Infinity;
    let protectionAreas = [];
    let fuelTargets = [];
    const fuelStrengths = new WeakMap();
    let resizeTimer = 0;

    function readPalette() {
      fieldColor = window.getComputedStyle(canvas).color;
      fieldColorRgb = parseColor(fieldColor);
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
          if (rect.width === 0 || rect.height === 0) return [];
          return [{
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            protectedOpacity
          }];
        })
      ));
    }

    // Visible cards become attractors inside the existing character field.
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

        if (rect.width === 0 || rect.height === 0 || bottom - top < 14) return [];

        return [{
          card,
          index,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          top,
          bottom
        }];
      });
    }

    function updateFuelStrengths() {
      fuelTargets.forEach((target) => {
        const isActive = target.card.matches(":hover")
          || target.card.matches(":focus-within");
        const requestedStrength = isActive ? 1 : 0;
        const previousStrength = fuelStrengths.get(target.card) || 0;
        const strength = reducedMotion.matches
          ? requestedStrength
          : previousStrength + (requestedStrength - previousStrength) * .12;

        fuelStrengths.set(target.card, strength);
      });
    }

    // Deform the real field glyphs into organic currents entering each card.
    function fuelAttractionAt(x, y, timestamp, isCompact) {
      let strongest = null;

      fuelTargets.forEach((target) => {
        const strength = fuelStrengths.get(target.card) || 0;
        const centerY = (target.top + target.bottom) * .5;
        const inlineCards = target.left > viewportWidth * .28;
        let candidate;

        if (inlineCards) {
          const sinkX = Math.min(
            target.right,
            target.left + Math.min(isCompact ? 34 : 52, target.width * .1)
          );
          const sourceX = Math.max(0, target.left - (isCompact ? 170 : 410));
          if (x < sourceX || x > sinkX) return;

          const baseProgress = clamp(
            (x - sourceX) / Math.max(1, sinkX - sourceX)
          );
          const travel = reducedMotion.matches
            ? baseProgress
            : (baseProgress + timestamp * .0000062) % 1;
          const curvePhase = timestamp * .000065 + target.index * .91;
          const curveAt = (progress) => {
            const envelope = .28 + .72 * (1 - Math.pow(progress, .74));
            const broadTurn = Math.sin(
              progress * Math.PI * 1.55 + curvePhase
            ) * (isCompact ? 26 : 72);
            const counterTurn = Math.sin(
              progress * Math.PI * 3.75 - curvePhase * .72 + target.index
            ) * (isCompact ? 9 : 25);
            const softTurn = Math.sin(
              progress * Math.PI * .72 + curvePhase * .45
            ) * (isCompact ? 7 : 18);

            return centerY + envelope * (broadTurn + counterTurn + softTurn);
          };
          const radiusAt = (progress) => {
            const narrowing = 1 - progress * .76;
            const widthVariation = .76 + .24 * Math.sin(
              progress * Math.PI * 3.4 + curvePhase * .8
            );

            return (isCompact ? 48 : 98) * narrowing * widthVariation;
          };
          const currentY = curveAt(baseProgress);
          const radius = radiusAt(baseProgress);
          const proximity = gaussian(
            (y - currentY) / Math.max(isCompact ? 11 : 15, radius),
            1.65
          );
          const filament = .64 + .36 * Math.pow(Math.abs(Math.sin(
            (y - currentY) * .13 + baseProgress * 8 - timestamp * .00012
          )), 2.4);
          const influence = proximity
            * filament
            * smoothstep(0, .18, baseProgress);
          const lane = (y - currentY) / Math.max(1, radius);
          const mappedX = sourceX + travel * (sinkX - sourceX);
          const mappedY = curveAt(travel) + lane * radiusAt(travel);

          candidate = {
            influence,
            driftX: (mappedX - x) * influence,
            driftY: (mappedY - y) * influence,
            intensityBoost: influence * (.2 + strength * .3),
            visibilityFloor: influence * (.3 + strength * .56),
            colorStrength: influence * (.28 + strength * .72),
            salience: strength * influence
          };
        } else {
          const aboveCard = y <= centerY;
          const sinkY = aboveCard ? target.top + 18 : target.bottom - 18;
          const sourceY = aboveCard
            ? target.top - (isCompact ? 95 : 145)
            : target.bottom + (isCompact ? 95 : 145);
          const minimumY = Math.min(sourceY, sinkY);
          const maximumY = Math.max(sourceY, sinkY);
          if (y < minimumY || y > maximumY) return;

          const rawProgress = aboveCard
            ? (y - sourceY) / Math.max(1, sinkY - sourceY)
            : (sourceY - y) / Math.max(1, sourceY - sinkY);
          const baseProgress = clamp(rawProgress);
          const travel = reducedMotion.matches
            ? baseProgress
            : (baseProgress + timestamp * .0000058) % 1;
          const portSpacing = isCompact ? 86 : 142;
          const portIndex = Math.round((x - target.left - portSpacing * .5) / portSpacing);
          const portX = clamp(
            target.left + portSpacing * (.5 + portIndex),
            target.left + 24,
            target.right - 24
          );
          const curvePhase = timestamp * .00007 + portIndex * .81;
          const curveAt = (progress) => {
            const envelope = 1 - Math.pow(progress, .72);
            const broadTurn = Math.sin(
              progress * Math.PI * 2.1 + curvePhase
            ) * (isCompact ? 14 : 30);
            const counterTurn = Math.sin(
              progress * Math.PI * 4.3 - curvePhase * .65
            ) * (isCompact ? 5 : 12);

            return portX + envelope * (broadTurn + counterTurn);
          };
          const radiusAt = (progress) => {
            const narrowing = 1 - progress * .62;
            const widthVariation = .78 + .22 * Math.sin(
              progress * Math.PI * 3 + curvePhase
            );

            return (isCompact ? 40 : 64) * narrowing * widthVariation;
          };
          const currentX = curveAt(baseProgress);
          const radius = radiusAt(baseProgress);
          const proximity = gaussian(
            (x - currentX) / Math.max(10, radius),
            1.9
          );
          const filament = .66 + .34 * Math.pow(Math.abs(Math.sin(
            (x - currentX) * .12 + baseProgress * 7 + timestamp * .00011
          )), 2.2);
          const influence = proximity
            * filament
            * smoothstep(0, .2, baseProgress);
          const lane = (x - currentX) / Math.max(1, radius);
          const mappedX = curveAt(travel) + lane * radiusAt(travel);
          const mappedY = aboveCard
            ? sourceY + travel * (sinkY - sourceY)
            : sourceY - travel * (sourceY - sinkY);

          candidate = {
            influence,
            driftX: (mappedX - x) * influence,
            driftY: (mappedY - y) * influence,
            intensityBoost: influence * (.16 + strength * .24),
            visibilityFloor: influence * (.25 + strength * .48),
            colorStrength: influence * (.28 + strength * .72),
            salience: strength * influence
          };
        }

        if (!strongest || candidate.influence > strongest.influence) {
          strongest = candidate;
        }
      });

      return strongest || {
        driftX: 0,
        driftY: 0,
        intensityBoost: 0,
        visibilityFloor: 0,
        influence: 0,
        colorStrength: 0,
        salience: 0
      };
    }

    function readabilityAt(x, y) {
      let visibility = 1;

      protectionAreas.forEach((area) => {
        const centerX = (area.left + area.right) * .5;
        const centerY = (area.top + area.bottom) * .5;
        const radiusX = Math.max((area.right - area.left) * .5 + 26, 34);
        const radiusY = Math.max((area.bottom - area.top) * .5 + 18, 25);
        const normalizedDistance = Math.hypot(
          (x - centerX) / radiusX,
          (y - centerY) / radiusY
        );
        const edgeBlend = smoothstep(.62, 1.2, normalizedDistance);
        const localVisibility = area.protectedOpacity
          + edgeBlend * (1 - area.protectedOpacity);

        visibility = Math.min(visibility, localVisibility);
      });

      return visibility;
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
      const bottom = clamp(footerTop, top, viewportHeight);
      return { top, bottom };
    }

    function draw(timestamp = 0) {
      const styleName = document.documentElement.dataset.asciiStyle || "manifold";
      const fieldFunction = FIELD_FUNCTIONS[styleName] || manifoldField;
      const characters = CHARACTER_SETS[styleName] || CHARACTER_SETS.manifold;
      const isCompact = viewportWidth < 700;
      const cellSize = isCompact ? 13 : 15;
      const columns = Math.ceil(viewportWidth / cellSize) + 1;
      const rows = Math.ceil(viewportHeight / cellSize) + 1;
      const motionSpeed = FIELD_MOTION_SPEED[styleName] || 1;
      const phase = reducedMotion.matches
        ? 0
        : timestamp * .000095 * motionSpeed;

      if (timestamp - lastProtectionRead >= 100) {
        readProtectionAreas();
        lastProtectionRead = timestamp;
      }

      context.clearRect(0, 0, viewportWidth, viewportHeight);
      context.fillStyle = fieldColor;
      context.font = `500 ${isCompact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

      const bounds = getDrawingBounds();
      if (timestamp - lastFuelRead >= 100) {
        readFuelTargets(bounds);
        lastFuelRead = timestamp;
      }
      updateFuelStrengths();

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
          const field = fieldFunction(normalizedX, normalizedY, phase, column, row);
          const fuel = fuelAttractionAt(x, y, timestamp, isCompact);
          const readability = readabilityAt(x, y);
          const effectiveReadability = Math.max(
            readability,
            fuel.visibilityFloor
          );
          const intensity = clamp(
            field.intensity * (.76 + effectiveReadability * .46)
              + fuel.intensityBoost
          );
          const random = gridNoise(column + 47, row + 19);
          const shouldSkip = intensity < .1
            || random > Math.max(
              .5 + intensity * .5,
              .34 + fuel.influence * .62
            )
            || (effectiveReadability < .24
              && gridNoise(column + 91, row + 7) > .3);

          if (shouldSkip) continue;

          const characterIndex = Math.min(
            characters.length - 1,
            Math.floor(Math.pow(intensity, .82) * characters.length)
          );
          const glyphShade = .68
            + (characterIndex / Math.max(1, characters.length - 1)) * .32;

          context.globalAlpha = (.03 + intensity * .44)
            * effectiveReadability
            * glyphShade
            * (1 + fuel.salience * .72);
          const glyphColor = fuel.colorStrength > .008
            ? mixColor(fieldColorRgb, accentColorRgb, fuel.colorStrength)
            : fieldColor;

          context.fillStyle = glyphColor;
          context.shadowColor = glyphColor;
          context.shadowBlur = intensity > .8 ? 7 : 0;
          context.fillText(
            characters[characterIndex],
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

      if (reducedMotion.matches) {
        draw(0);
      } else {
        animationFrame = window.requestAnimationFrame(animate);
      }
    }

    function invalidateLayout() {
      lastProtectionRead = -Infinity;
      lastFuelRead = -Infinity;
    }

    document.addEventListener("scroll", invalidateLayout, { passive: true, capture: true });

    resizeCanvas();
    updateMotion();

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
    window.addEventListener("site-ascii-change", () => {
      invalidateLayout();
      draw(window.performance.now());
    });

    reducedMotion.addEventListener?.("change", updateMotion);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
      } else {
        updateMotion();
      }
    });
  }

  initializeAsciiField();
})();
